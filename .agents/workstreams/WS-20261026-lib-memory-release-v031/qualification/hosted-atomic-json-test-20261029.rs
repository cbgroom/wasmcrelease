#[tokio::test(flavor="multi_thread",worker_threads=2)]
async fn candidate_wasmc_json_hosted_route_atomic_table_write() -> Result<()> {
    let mut fixture=Fixture::new_with_http_route()?;
    let capabilities=BTreeSet::from([
        "mcpgit:result/v2.dynamic-batch".to_string(),
        "mcpgit:service/v1.invoke".to_string(),
        "mcpgit:table/v1.invoke".to_string(),
    ]);
    let plugin=fixture.repo_path.join("runtime_skills/http-route/runtime/plugin.json");
    let mut manifest:Value=serde_json::from_slice(&fs::read(&plugin)?)?;
    manifest["requested_capabilities"]=serde_json::to_value(&capabilities)?;
    fs::write(&plugin,serde_json::to_vec_pretty(&manifest)?)?;
    fs::write(fixture.repo_path.join("runtime_skills/http-route/wit/programmable-query.wit"),mcpgit_guest_contract::PROGRAMMABLE_QUERY_WIT_BYTES)?;
    let repo=Repository::open(&fixture.repo_path)?;
    let mut index=repo.index()?;index.add_all(["*"],IndexAddOption::DEFAULT,None)?;index.write()?;
    let tree=repo.find_tree(index.write_tree()?)?;let parent=repo.head()?.peel_to_commit()?;
    let signature=Signature::now("JSON route fixture","json-route@example.invalid")?;
    fixture.initial_revision=repo.commit(Some("HEAD"),&signature,&signature,"Declare JSON route capabilities",&tree,&[&parent])?.to_string();
    drop(tree);drop(parent);drop(index);drop(repo);
    let store=configured_store(fixture.repo_path.clone());
    let service=McpGitService::new(store.clone(),ServiceAuthorization::local())?;
    let client=service_client(service);
    let mut revision=initialize_skill_table(&client,"runtime_skills",fixture.initial_revision.clone()).await?;
    revision=create_typed_control_table(&client,"skill_activations","activation_id",&[
        ("activation_id",sdk::TableFieldType::String),("skill_id",sdk::TableFieldType::String),
        ("table_path",sdk::TableFieldType::String),("package_revision",sdk::TableFieldType::String),
        ("package_tree_oid",sdk::TableFieldType::String),("artifact_locator",sdk::TableFieldType::String),
        ("artifact_object_version",sdk::TableFieldType::String),("artifact_sha256",sdk::TableFieldType::String),
        ("runtime_abi",sdk::TableFieldType::String),("approved_capabilities",sdk::TableFieldType::Array),
        ("state",sdk::TableFieldType::String)],revision).await?;
    let artifact=fs::read(std::env::var("MCPGIT_CANDIDATE_WASMC_ROUTE_APP")?)?;
    let digest=artifact_digest(&artifact);
    revision=add_artifact(&client,"runtime_skills",HTTP_ROUTE_SKILL,revision,&artifact).await?;
    let package=package_manifest(&client,"runtime_skills",HTTP_ROUTE_SKILL,&revision).await?;
    let pin=artifact_pin_from_manifest("runtime_skills",HTTP_ROUTE_SKILL,ARTIFACT,&digest,&package)?;
    let activation=ActivationRow{activation_id:"activation-json-route-v1".into(),skill_id:HTTP_ROUTE_SKILL.into(),table_path:"runtime_skills".into(),package_revision:pin.package_revision.clone(),package_tree_oid:pin.package_tree_oid.clone(),artifact_locator:pin.artifact_locator.clone(),artifact_object_version:pin.artifact_object_version.clone(),artifact_sha256:pin.artifact_sha256.clone(),runtime_abi:CORE_RUNTIME_ABI.into(),approved_capabilities:capabilities.iter().cloned().collect(),state:"active".into()};
    revision=insert_activation(&client,&activation,revision).await?;
    revision=create_typed_control_table(&client,"json_results","id",&[("id",sdk::TableFieldType::String),("value",sdk::TableFieldType::Json),("processed",sdk::TableFieldType::Boolean),("sequence",sdk::TableFieldType::Integer)],revision).await?;
    let mut raw=route_binding("json-route-v1","/json");raw.activation_id=activation.activation_id.clone();raw.activation_pin_sha256=activation_pin_sha256(&activation)?;raw.methods=BTreeSet::from(["POST".to_string()]);raw.binding_capabilities=capabilities.clone();
    let binding=VersionedHttpRouteBinding{row_version:1,row_sha256:http_route_binding_sha256(&raw)?,binding:raw};
    let mut limits=HttpRouteLimits::bounded_default();limits.fuel=1_000_000_000;let publication=RoutePublication::ready("publication-json-route-v1",1,revision,vec![binding],limits.schema.clone())?;
    let authority=Arc::new(MemoryRouteAuthority::default());authority.insert_publication(publication.clone())?;
    let caller_client=client.clone();
    let executor=Arc::new(TableGitWasmtimeRouteExecutor::new_with_policies(REPO,client.clone(),limits,WasmModuleCacheLimits::bounded_default(),RouteLogPolicy::none())?.with_table_client_resolver(Arc::new(move |_|caller_client.clone())));
    let route_executor:Arc<dyn RouteExecutor>=executor;
    let registry=Arc::new(OrganizationRouteRegistry::restore("organization-a",authority,route_executor).await?);
    registry.publish(&publication.publication_id,None,Duration::ZERO).await?;
    let dispatcher=RegistryHostedPluginDispatcher::new(REPO,registry);
    for n in [1,2] {
        let status=client.table_status(sdk::GetTableStatusRequest{repo:REPO.into(),view:sdk::TableView::Worktree{topic_id:Some("main".into())},path:"json_results".into()}).await?;
        let head=status.revision.context("missing current table revision")?;
        let key=format!("row-{n}");
        let body=serde_json::to_string(&json!({"repo":REPO,"worktree":{"topic_id":"main"},"path":"json_results","expected_revision":head,"transaction_id":Uuid::new_v4().to_string(),"idempotency_key":null,"actor":null,"message":null,"many":n==2,"operations":[{"op":"insert","operation_id":Uuid::new_v4().to_string(),"key":key,"row":{"id":key,"value":{},"processed":false,"sequence":0}}]}))?;
        let request=hosting::HostedPluginRequest{organization_id:"organization-a".into(),repository_id:REPO.into(),site_id:"prototype".into(),method:"POST".into(),path:"/json".into(),query:vec![],headers:BTreeMap::new(),header_fields:vec![],body:Bytes::from(body.clone()),caller:hosting::HostedPluginCaller{principal_id:"hosted:fixture".into(),person_id:Some(PERSON.into()),authentication_mode:"fixture".into(),permissions:BTreeSet::from(["repo.read".into()]),capabilities:capabilities.clone(),table_scope_restricted:false}};
        let result=hosting::HostedPluginDispatcher::dispatch(&dispatcher,request).await;
        match result {hosting::HostedPluginDispatch::Response(response)=>{eprintln!("HOSTED_ROUTE_STATUS={} BODY={}",response.status,String::from_utf8_lossy(&response.body));ensure!(response.status==201,"unexpected HTTP status {}",response.status);ensure!(serde_json::from_slice::<Value>(&response.body)?==serde_json::from_str::<Value>(&body)?,"JSON response drift");},other=>anyhow::bail!("unexpected route result: {other:?}")}
        let rows=client.get_table_rows(sdk::GetTableRowsRequest{repo:REPO.into(),view:sdk::TableView::Worktree{topic_id:Some("main".into())},path:"json_results".into(),keys:vec![key.clone()],select:None,include_deleted:Some(false)}).await?;
        ensure!(rows.rows.len()==1,"written row missing");let row=rows.rows[0].row.as_ref().context("missing row payload")?;
        ensure!(row["id"]==key && row["processed"]==true && row["sequence"]==42,"row scalar values drift: {row}");
        ensure!(row["value"]["name"]=="雪" && row["value"]["items"]==json!(vec![123; if n==2 {300}else{1}]),"constructed JSON drift: {row}");
        eprintln!("HOSTED_ATOMIC_ROW_OK key={key} item_count={} revision={}",if n==2 {300}else{1},rows.revision);
    }
    Ok(())
}

#[tokio::test(flavor="multi_thread",worker_threads=2)]
async fn candidate_wasmc_json_hosted_route_atomic_unlimited_resources() -> Result<()> {
    let mut fixture=Fixture::new_with_http_route()?;
    let capabilities=BTreeSet::from([
        "mcpgit:result/v2.dynamic-batch".to_string(),
        "mcpgit:service/v1.invoke".to_string(),
        "mcpgit:table/v1.invoke".to_string(),
    ]);
    let plugin=fixture.repo_path.join("runtime_skills/http-route/runtime/plugin.json");
    let mut manifest:Value=serde_json::from_slice(&fs::read(&plugin)?)?;
    manifest["requested_capabilities"]=serde_json::to_value(&capabilities)?;
    fs::write(&plugin,serde_json::to_vec_pretty(&manifest)?)?;
    fs::write(fixture.repo_path.join("runtime_skills/http-route/wit/programmable-query.wit"),mcpgit_guest_contract::PROGRAMMABLE_QUERY_WIT_BYTES)?;
    let repo=Repository::open(&fixture.repo_path)?;
    let mut index=repo.index()?;index.add_all(["*"],IndexAddOption::DEFAULT,None)?;index.write()?;
    let tree=repo.find_tree(index.write_tree()?)?;let parent=repo.head()?.peel_to_commit()?;
    let signature=Signature::now("JSON route fixture","json-route@example.invalid")?;
    fixture.initial_revision=repo.commit(Some("HEAD"),&signature,&signature,"Declare JSON route capabilities",&tree,&[&parent])?.to_string();
    drop(tree);drop(parent);drop(index);drop(repo);
    let store=configured_store(fixture.repo_path.clone());
    let service=McpGitService::new(store.clone(),ServiceAuthorization::local())?;
    let client=service_client(service);
    let mut revision=initialize_skill_table(&client,"runtime_skills",fixture.initial_revision.clone()).await?;
    revision=create_typed_control_table(&client,"skill_activations","activation_id",&[
        ("activation_id",sdk::TableFieldType::String),("skill_id",sdk::TableFieldType::String),
        ("table_path",sdk::TableFieldType::String),("package_revision",sdk::TableFieldType::String),
        ("package_tree_oid",sdk::TableFieldType::String),("artifact_locator",sdk::TableFieldType::String),
        ("artifact_object_version",sdk::TableFieldType::String),("artifact_sha256",sdk::TableFieldType::String),
        ("runtime_abi",sdk::TableFieldType::String),("approved_capabilities",sdk::TableFieldType::Array),
        ("state",sdk::TableFieldType::String)],revision).await?;
    let artifact=fs::read(std::env::var("MCPGIT_CANDIDATE_WASMC_ROUTE_APP")?)?;
    let digest=artifact_digest(&artifact);
    revision=add_artifact(&client,"runtime_skills",HTTP_ROUTE_SKILL,revision,&artifact).await?;
    let package=package_manifest(&client,"runtime_skills",HTTP_ROUTE_SKILL,&revision).await?;
    let pin=artifact_pin_from_manifest("runtime_skills",HTTP_ROUTE_SKILL,ARTIFACT,&digest,&package)?;
    let activation=ActivationRow{activation_id:"activation-json-route-v1".into(),skill_id:HTTP_ROUTE_SKILL.into(),table_path:"runtime_skills".into(),package_revision:pin.package_revision.clone(),package_tree_oid:pin.package_tree_oid.clone(),artifact_locator:pin.artifact_locator.clone(),artifact_object_version:pin.artifact_object_version.clone(),artifact_sha256:pin.artifact_sha256.clone(),runtime_abi:CORE_RUNTIME_ABI.into(),approved_capabilities:capabilities.iter().cloned().collect(),state:"active".into()};
    revision=insert_activation(&client,&activation,revision).await?;
    revision=create_typed_control_table(&client,"json_results","id",&[("id",sdk::TableFieldType::String),("value",sdk::TableFieldType::Json),("processed",sdk::TableFieldType::Boolean),("sequence",sdk::TableFieldType::Integer)],revision).await?;
    let mut raw=route_binding("json-route-v1","/json");raw.activation_id=activation.activation_id.clone();raw.activation_pin_sha256=activation_pin_sha256(&activation)?;raw.methods=BTreeSet::from(["POST".to_string()]);raw.binding_capabilities=capabilities.clone();
    let binding=VersionedHttpRouteBinding{row_version:1,row_sha256:http_route_binding_sha256(&raw)?,binding:raw};
    let limits=mcpgit_executable_runtime::http_resources::HttpResources::default().effective_limits()?;let publication=RoutePublication::ready("publication-json-route-v1",1,revision,vec![binding],limits.schema.clone())?;
    let authority=Arc::new(MemoryRouteAuthority::default());authority.insert_publication(publication.clone())?;
    let caller_client=client.clone();
    let executor=Arc::new(TableGitWasmtimeRouteExecutor::new_with_policies(REPO,client.clone(),limits,WasmModuleCacheLimits::bounded_default(),RouteLogPolicy::none())?.with_table_client_resolver(Arc::new(move |_|caller_client.clone())));
    let route_executor:Arc<dyn RouteExecutor>=executor;
    let registry=Arc::new(OrganizationRouteRegistry::restore("organization-a",authority,route_executor).await?);
    registry.publish(&publication.publication_id,None,Duration::ZERO).await?;
    let dispatcher=RegistryHostedPluginDispatcher::new(REPO,registry);
    for n in [1,2] {
        let status=client.table_status(sdk::GetTableStatusRequest{repo:REPO.into(),view:sdk::TableView::Worktree{topic_id:Some("main".into())},path:"json_results".into()}).await?;
        let head=status.revision.context("missing current table revision")?;
        let key=format!("row-{n}");
        let body=serde_json::to_string(&json!({"repo":REPO,"worktree":{"topic_id":"main"},"path":"json_results","expected_revision":head,"transaction_id":Uuid::new_v4().to_string(),"idempotency_key":null,"actor":null,"message":null,"many":n==2,"operations":[{"op":"insert","operation_id":Uuid::new_v4().to_string(),"key":key,"row":{"id":key,"value":{},"processed":false,"sequence":0}}]}))?;
        let request=hosting::HostedPluginRequest{organization_id:"organization-a".into(),repository_id:REPO.into(),site_id:"prototype".into(),method:"POST".into(),path:"/json".into(),query:vec![],headers:BTreeMap::new(),header_fields:vec![],body:Bytes::from(body.clone()),caller:hosting::HostedPluginCaller{principal_id:"hosted:fixture".into(),person_id:Some(PERSON.into()),authentication_mode:"fixture".into(),permissions:BTreeSet::from(["repo.read".into()]),capabilities:capabilities.clone(),table_scope_restricted:false}};
        let result=hosting::HostedPluginDispatcher::dispatch(&dispatcher,request).await;
        match result {hosting::HostedPluginDispatch::Response(response)=>{eprintln!("HOSTED_ROUTE_STATUS={} BODY={}",response.status,String::from_utf8_lossy(&response.body));ensure!(response.status==201,"unexpected HTTP status {}",response.status);ensure!(serde_json::from_slice::<Value>(&response.body)?==serde_json::from_str::<Value>(&body)?,"JSON response drift");},other=>anyhow::bail!("unexpected route result: {other:?}")}
        let rows=client.get_table_rows(sdk::GetTableRowsRequest{repo:REPO.into(),view:sdk::TableView::Worktree{topic_id:Some("main".into())},path:"json_results".into(),keys:vec![key.clone()],select:None,include_deleted:Some(false)}).await?;
        ensure!(rows.rows.len()==1,"written row missing");let row=rows.rows[0].row.as_ref().context("missing row payload")?;
        ensure!(row["id"]==key && row["processed"]==true && row["sequence"]==42,"row scalar values drift: {row}");
        ensure!(row["value"]["name"]=="雪" && row["value"]["items"]==json!(vec![123; if n==2 {300}else{1}]),"constructed JSON drift: {row}");
        eprintln!("HOSTED_ATOMIC_ROW_OK key={key} item_count={} revision={}",if n==2 {300}else{1},rows.revision);
    }
    Ok(())
}
