#![allow(static_mut_refs, unsafe_op_in_unsafe_fn)]
// Generated dependency-free Canonical value SDK.
pub const LIB_PACKAGE: &str = "wasmc-json";
pub const LIB_VERSION: &str = "0.2.4";
pub const LIB_WIT_SHA256: &str = "6ab0a1485a9e4a2ec099c59be4c3cbf203b2ad8c928327d57128a041ba9314b8";
pub const LIB_ARTIFACT_SHA256: &str = "08d0d60134228dabbfc467429b2e54c97910d9d1d8e0a3f49f11228668b11384";
pub const LIB_IMPORT_MODULE: &str = "wasmc:lib/wasmc-json@0.2.4";
/* Upstream wit-bindgen runtime LICENSE-MIT
Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/
/* Upstream wit-bindgen runtime LICENSE-APACHE
                              Apache License
                        Version 2.0, January 2004
                     http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

   "License" shall mean the terms and conditions for use, reproduction,
   and distribution as defined by Sections 1 through 9 of this document.

   "Licensor" shall mean the copyright owner or entity authorized by
   the copyright owner that is granting the License.

   "Legal Entity" shall mean the union of the acting entity and all
   other entities that control, are controlled by, or are under common
   control with that entity. For the purposes of this definition,
   "control" means (i) the power, direct or indirect, to cause the
   direction or management of such entity, whether by contract or
   otherwise, or (ii) ownership of fifty percent (50%) or more of the
   outstanding shares, or (iii) beneficial ownership of such entity.

   "You" (or "Your") shall mean an individual or Legal Entity
   exercising permissions granted by this License.

   "Source" form shall mean the preferred form for making modifications,
   including but not limited to software source code, documentation
   source, and configuration files.

   "Object" form shall mean any form resulting from mechanical
   transformation or translation of a Source form, including but
   not limited to compiled object code, generated documentation,
   and conversions to other media types.

   "Work" shall mean the work of authorship, whether in Source or
   Object form, made available under the License, as indicated by a
   copyright notice that is included in or attached to the work
   (an example is provided in the Appendix below).

   "Derivative Works" shall mean any work, whether in Source or Object
   form, that is based on (or derived from) the Work and for which the
   editorial revisions, annotations, elaborations, or other modifications
   represent, as a whole, an original work of authorship. For the purposes
   of this License, Derivative Works shall not include works that remain
   separable from, or merely link (or bind by name) to the interfaces of,
   the Work and Derivative Works thereof.

   "Contribution" shall mean any work of authorship, including
   the original version of the Work and any modifications or additions
   to that Work or Derivative Works thereof, that is intentionally
   submitted to Licensor for inclusion in the Work by the copyright owner
   or by an individual or Legal Entity authorized to submit on behalf of
   the copyright owner. For the purposes of this definition, "submitted"
   means any form of electronic, verbal, or written communication sent
   to the Licensor or its representatives, including but not limited to
   communication on electronic mailing lists, source code control systems,
   and issue tracking systems that are managed by, or on behalf of, the
   Licensor for the purpose of discussing and improving the Work, but
   excluding communication that is conspicuously marked or otherwise
   designated in writing by the copyright owner as "Not a Contribution."

   "Contributor" shall mean Licensor and any individual or Legal Entity
   on behalf of whom a Contribution has been received by Licensor and
   subsequently incorporated within the Work.

2. Grant of Copyright License. Subject to the terms and conditions of
   this License, each Contributor hereby grants to You a perpetual,
   worldwide, non-exclusive, no-charge, royalty-free, irrevocable
   copyright license to reproduce, prepare Derivative Works of,
   publicly display, publicly perform, sublicense, and distribute the
   Work and such Derivative Works in Source or Object form.

3. Grant of Patent License. Subject to the terms and conditions of
   this License, each Contributor hereby grants to You a perpetual,
   worldwide, non-exclusive, no-charge, royalty-free, irrevocable
   (except as stated in this section) patent license to make, have made,
   use, offer to sell, sell, import, and otherwise transfer the Work,
   where such license applies only to those patent claims licensable
   by such Contributor that are necessarily infringed by their
   Contribution(s) alone or by combination of their Contribution(s)
   with the Work to which such Contribution(s) was submitted. If You
   institute patent litigation against any entity (including a
   cross-claim or counterclaim in a lawsuit) alleging that the Work
   or a Contribution incorporated within the Work constitutes direct
   or contributory patent infringement, then any patent licenses
   granted to You under this License for that Work shall terminate
   as of the date such litigation is filed.

4. Redistribution. You may reproduce and distribute copies of the
   Work or Derivative Works thereof in any medium, with or without
   modifications, and in Source or Object form, provided that You
   meet the following conditions:

   (a) You must give any other recipients of the Work or
       Derivative Works a copy of this License; and

   (b) You must cause any modified files to carry prominent notices
       stating that You changed the files; and

   (c) You must retain, in the Source form of any Derivative Works
       that You distribute, all copyright, patent, trademark, and
       attribution notices from the Source form of the Work,
       excluding those notices that do not pertain to any part of
       the Derivative Works; and

   (d) If the Work includes a "NOTICE" text file as part of its
       distribution, then any Derivative Works that You distribute must
       include a readable copy of the attribution notices contained
       within such NOTICE file, excluding those notices that do not
       pertain to any part of the Derivative Works, in at least one
       of the following places: within a NOTICE text file distributed
       as part of the Derivative Works; within the Source form or
       documentation, if provided along with the Derivative Works; or,
       within a display generated by the Derivative Works, if and
       wherever such third-party notices normally appear. The contents
       of the NOTICE file are for informational purposes only and
       do not modify the License. You may add Your own attribution
       notices within Derivative Works that You distribute, alongside
       or as an addendum to the NOTICE text from the Work, provided
       that such additional attribution notices cannot be construed
       as modifying the License.

   You may add Your own copyright statement to Your modifications and
   may provide additional or different license terms and conditions
   for use, reproduction, or distribution of Your modifications, or
   for any such Derivative Works as a whole, provided Your use,
   reproduction, and distribution of the Work otherwise complies with
   the conditions stated in this License.

5. Submission of Contributions. Unless You explicitly state otherwise,
   any Contribution intentionally submitted for inclusion in the Work
   by You to the Licensor shall be under the terms and conditions of
   this License, without any additional terms or conditions.
   Notwithstanding the above, nothing herein shall supersede or modify
   the terms of any separate license agreement you may have executed
   with Licensor regarding such Contributions.

6. Trademarks. This License does not grant permission to use the trade
   names, trademarks, service marks, or product names of the Licensor,
   except as required for reasonable and customary use in describing the
   origin of the Work and reproducing the content of the NOTICE file.

7. Disclaimer of Warranty. Unless required by applicable law or
   agreed to in writing, Licensor provides the Work (and each
   Contributor provides its Contributions) on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
   implied, including, without limitation, any warranties or conditions
   of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
   PARTICULAR PURPOSE. You are solely responsible for determining the
   appropriateness of using or redistributing the Work and assume any
   risks associated with Your exercise of permissions under this License.

8. Limitation of Liability. In no event and under no legal theory,
   whether in tort (including negligence), contract, or otherwise,
   unless required by applicable law (such as deliberate and grossly
   negligent acts) or agreed to in writing, shall any Contributor be
   liable to You for damages, including any direct, indirect, special,
   incidental, or consequential damages of any character arising as a
   result of this License or out of the use or inability to use the
   Work (including but not limited to damages for loss of goodwill,
   work stoppage, computer failure or malfunction, or any and all
   other commercial damages or losses), even if such Contributor
   has been advised of the possibility of such damages.

9. Accepting Warranty or Additional Liability. While redistributing
   the Work or Derivative Works thereof, You may choose to offer,
   and charge a fee for, acceptance of support, warranty, indemnity,
   or other liability obligations and/or rights consistent with this
   License. However, in accepting such obligations, You may act only
   on Your own behalf and on Your sole responsibility, not on behalf
   of any other Contributor, and only if You agree to indemnify,
   defend, and hold each Contributor harmless for any liability
   incurred by, or claims asserted against, such Contributor by reason
   of your accepting any such warranty or additional liability.

END OF TERMS AND CONDITIONS

APPENDIX: How to apply the Apache License to your work.

   To apply the Apache License to your work, attach the following
   boilerplate notice, with the fields enclosed by brackets "[]"
   replaced with your own identifying information. (Don't include
   the brackets!)  The text should be enclosed in the appropriate
   comment syntax for the file format. We also recommend that a
   file or class name and description of purpose be included on the
   same "printed page" as the copyright notice for easier
   identification within third-party archives.

Copyright [yyyy] [name of copyright owner]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
extern crate alloc;
extern crate self as wit_bindgen;
pub mod rt {
use core::alloc::Layout;
use core::ptr::{self,NonNull};
/// Cleanup helper used to deallocate blocks of canonical ABI data from
/// lowerings.
pub struct Cleanup {
    ptr: NonNull<u8>,
    layout: Layout,
}

// Usage of the returned pointer is always unsafe and must abide by these
// conventions, but this structure itself has no inherent reason to not be
// send/sync.
unsafe impl Send for Cleanup {}
unsafe impl Sync for Cleanup {}

impl Cleanup {
    /// Allocates a chunk of memory with `layout` and returns an object to clean
    /// it up.
    ///
    /// Always returns a pointer which is null if `layout` has size zero. The
    /// optional cleanup returned will be present if `layout` has a non-zero
    /// size. When dropped `Cleanup` will deallocate the pointer returned.
    pub fn new(layout: Layout) -> (*mut u8, Option<Cleanup>) {
        use alloc::alloc;

        if layout.size() == 0 {
            return (ptr::null_mut(), None);
        }
        let ptr = unsafe { alloc::alloc(layout) };
        let ptr = match NonNull::new(ptr) {
            Some(ptr) => ptr,
            None => alloc::handle_alloc_error(layout),
        };
        (ptr.as_ptr(), Some(Cleanup { ptr, layout }))
    }

    /// Discards this cleanup to leak its memory or intentionally transfer
    /// ownership to some other location.
    pub fn forget(self) {
        core::mem::forget(self);
    }
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        unsafe {
            for i in 0..self.layout.size() {
                *self.ptr.add(i).as_ptr() = 0xff;
            }
            alloc::alloc::dealloc(self.ptr.as_ptr(), self.layout);
        }
    }
}

}
// Generated by `wit-bindgen` 0.62.0. DO NOT EDIT!
// Options used:
//   * generate_unused_types
//   * disable_custom_section_link_helpers
#[allow(dead_code, clippy::all)]
pub mod wasmc {
  pub mod json {

    #[allow(dead_code, async_fn_in_trait, unused_imports, clippy::all)]
    pub mod document {
      
      use super::super::super::_rt;
      #[repr(u8)]
      #[derive(Clone, Copy, Eq, Ord, PartialEq, PartialOrd)]
      pub enum JsonError {
        InvalidJson,
        InvalidPointer,
        MissingTarget,
        TypeMismatch,
        InvalidIndex,
        OutOfRange,
        InvalidOperation,
        AllocationFailed,
      }
      impl JsonError{
        pub fn name(&self) -> &'static str {
          match self {
            JsonError::InvalidJson => "invalid-json",
            JsonError::InvalidPointer => "invalid-pointer",
            JsonError::MissingTarget => "missing-target",
            JsonError::TypeMismatch => "type-mismatch",
            JsonError::InvalidIndex => "invalid-index",
            JsonError::OutOfRange => "out-of-range",
            JsonError::InvalidOperation => "invalid-operation",
            JsonError::AllocationFailed => "allocation-failed",
          }
        }
        pub fn message(&self) -> &'static str {
          match self {
            JsonError::InvalidJson => "",
            JsonError::InvalidPointer => "",
            JsonError::MissingTarget => "",
            JsonError::TypeMismatch => "",
            JsonError::InvalidIndex => "",
            JsonError::OutOfRange => "",
            JsonError::InvalidOperation => "",
            JsonError::AllocationFailed => "",
          }
        }
      }
      impl ::core::fmt::Debug for JsonError{
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("JsonError")
          .field("code", &(*self as i32))
          .field("name", &self.name())
          .field("message", &self.message())
          .finish()
        }
      }
      impl ::core::fmt::Display for JsonError{
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          write!(f, "{} (error {})", self.name(), *self as i32)
        }
      }

      impl ::core::error::Error for JsonError {}

      impl JsonError{
        #[doc(hidden)]
        pub unsafe fn _lift(val: u8) -> JsonError{
          if !cfg!(debug_assertions) {
            return unsafe { ::core::mem::transmute(val) };
          }

          match val {
            0 => JsonError::InvalidJson,
            1 => JsonError::InvalidPointer,
            2 => JsonError::MissingTarget,
            3 => JsonError::TypeMismatch,
            4 => JsonError::InvalidIndex,
            5 => JsonError::OutOfRange,
            6 => JsonError::InvalidOperation,
            7 => JsonError::AllocationFailed,

            _ => panic!("invalid enum discriminant"),
          }
        }
      }

      /// Record view of the same Rust selection; missing has present=false and empty json.
      /// Present JSON null has present=true and json="null".
      #[derive(Clone)]
      pub struct SelectedValue {
        pub present: bool,
        pub json: _rt::String,
      }
      impl ::core::fmt::Debug for SelectedValue {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("SelectedValue").field("present", &self.present).field("json", &self.json).finish()
        }
      }
      #[derive(Clone)]
      pub struct SelectionView {
        pub valid: bool,
        pub values: _rt::Vec::<SelectedValue>,
        pub error: ::core::option::Option<JsonError>,
      }
      impl ::core::fmt::Debug for SelectionView {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("SelectionView").field("valid", &self.valid).field("values", &self.values).field("error", &self.error).finish()
        }
      }
      #[derive(Clone)]
      pub struct JsonField {
        pub name: _rt::String,
        pub value_json: _rt::String,
      }
      impl ::core::fmt::Debug for JsonField {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("JsonField").field("name", &self.name).field("value-json", &self.value_json).finish()
        }
      }
      #[repr(u8)]
      #[derive(Clone, Copy, Eq, Ord, PartialEq, PartialOrd)]
      pub enum EditKind {
        Set,
        Remove,
      }
      impl ::core::fmt::Debug for EditKind {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          match self {
            EditKind::Set => {
              f.debug_tuple("EditKind::Set").finish()
            }
            EditKind::Remove => {
              f.debug_tuple("EditKind::Remove").finish()
            }
          }
        }
      }

      impl EditKind{
        #[doc(hidden)]
        pub unsafe fn _lift(val: u8) -> EditKind{
          if !cfg!(debug_assertions) {
            return unsafe { ::core::mem::transmute(val) };
          }

          match val {
            0 => EditKind::Set,
            1 => EditKind::Remove,

            _ => panic!("invalid enum discriminant"),
          }
        }
      }

      #[derive(Clone)]
      pub struct Edit {
        pub kind: EditKind,
        pub path: _rt::String,
        pub value_json: _rt::String,
      }
      impl ::core::fmt::Debug for Edit {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("Edit").field("kind", &self.kind).field("path", &self.path).field("value-json", &self.value_json).finish()
        }
      }
      #[repr(C)]
      #[derive(Clone, Copy)]
      pub struct UnsignedValue {
        pub present: bool,
        pub value: u64,
      }
      impl ::core::fmt::Debug for UnsignedValue {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("UnsignedValue").field("present", &self.present).field("value", &self.value).finish()
        }
      }
      #[repr(C)]
      #[derive(Clone, Copy)]
      pub struct SignedValue {
        pub present: bool,
        pub value: i64,
      }
      impl ::core::fmt::Debug for SignedValue {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("SignedValue").field("present", &self.present).field("value", &self.value).finish()
        }
      }
      #[repr(C)]
      #[derive(Clone, Copy)]
      pub struct FloatValue {
        pub present: bool,
        pub value: f64,
      }
      impl ::core::fmt::Debug for FloatValue {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("FloatValue").field("present", &self.present).field("value", &self.value).finish()
        }
      }
      #[repr(C)]
      #[derive(Clone, Copy)]
      pub struct BooleanValue {
        pub present: bool,
        pub value: bool,
      }
      impl ::core::fmt::Debug for BooleanValue {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
          f.debug_struct("BooleanValue").field("present", &self.present).field("value", &self.value).finish()
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn compact(input: &str,) -> ::core::result::Result<_rt::String,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let ptr1 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_0"]
            fn wit_import2(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import2(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import2(ptr0.cast_mut(), len0, ptr1);
          let l3 = i32::from(*ptr1.add(0).cast::<u8>());
          let result8 = match l3 {
            0 => {
              let e = {
                let l4 = *ptr1.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l5 = *ptr1.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let len6 = l5;
                let bytes6 = _rt::Vec::from_raw_parts(l4.cast(), len6, len6);

                _rt::string_lift(bytes6)
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l7 = i32::from(*ptr1.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l7 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result8
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn select(input: &str,pointers: &[_rt::String],) -> ::core::result::Result<_rt::Vec::<::core::option::Option<_rt::String>>,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec2 = pointers;
          let len2 = vec2.len();
          let layout2 = _rt::alloc::Layout::from_size_align(vec2.len() * (2*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result2, _cleanup2) = wit_bindgen::rt::Cleanup::new(layout2);for (i, e) in vec2.into_iter().enumerate() {
            let base = result2.add(i * (2*::core::mem::size_of::<*const u8>()));
            {
              let vec1 = e;
              let ptr1 = vec1.as_ptr().cast::<u8>();
              let len1 = vec1.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len1;
              *base.add(0).cast::<*mut u8>() = ptr1.cast_mut();
            }
          }
          let ptr3 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_1"]
            fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import4(ptr0.cast_mut(), len0, result2, len2, ptr3);
          let l5 = i32::from(*ptr3.add(0).cast::<u8>());
          let result14 = match l5 {
            0 => {
              let e = {
                let l6 = *ptr3.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l7 = *ptr3.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let base12 = l6;
                let len12 = l7;
                let mut result12 = _rt::Vec::with_capacity(len12);
                for i in 0..len12 {
                  let base = base12.add(i * (3*::core::mem::size_of::<*const u8>()));
                  let e12 = {
                    let l8 = i32::from(*base.add(0).cast::<u8>());

                    match l8 {
                      0 => None,
                      1 => {
                        let e = {
                          let l9 = *base.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                          let l10 = *base.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                          let len11 = l10;
                          let bytes11 = _rt::Vec::from_raw_parts(l9.cast(), len11, len11);

                          _rt::string_lift(bytes11)
                        };
                        Some(e)
                      }
                      _ => _rt::invalid_enum_discriminant(),
                    }
                  };
                  result12.push(e12);
                }
                _rt::cabi_dealloc(base12, len12 * (3*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>());

                result12
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l13 = i32::from(*ptr3.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l13 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result14
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn validate(input: &str,) -> ::core::result::Result<(),JsonError>{
        unsafe {

          #[repr(align(1))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let ptr1 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_2"]
            fn wit_import2(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import2(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import2(ptr0.cast_mut(), len0, ptr1);
          let l3 = i32::from(*ptr1.add(0).cast::<u8>());
          let result5 = match l3 {
            0 => {
              let e = ();
              Ok(e)
            }
            1 => {
              let e = {
                let l4 = i32::from(*ptr1.add(1).cast::<u8>());

                JsonError::_lift(l4 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result5
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Identical Rust JSON semantics with binary input, parsed directly by serde_json.
      #[allow(async_fn_in_trait)]
      pub fn compact_bytes(input: &[u8],) -> ::core::result::Result<_rt::String,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let ptr1 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_3"]
            fn wit_import2(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import2(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import2(ptr0.cast_mut(), len0, ptr1);
          let l3 = i32::from(*ptr1.add(0).cast::<u8>());
          let result8 = match l3 {
            0 => {
              let e = {
                let l4 = *ptr1.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l5 = *ptr1.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let len6 = l5;
                let bytes6 = _rt::Vec::from_raw_parts(l4.cast(), len6, len6);

                _rt::string_lift(bytes6)
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l7 = i32::from(*ptr1.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l7 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result8
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn select_bytes(input: &[u8],pointers: &[_rt::String],) -> ::core::result::Result<_rt::Vec::<::core::option::Option<_rt::String>>,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec2 = pointers;
          let len2 = vec2.len();
          let layout2 = _rt::alloc::Layout::from_size_align(vec2.len() * (2*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result2, _cleanup2) = wit_bindgen::rt::Cleanup::new(layout2);for (i, e) in vec2.into_iter().enumerate() {
            let base = result2.add(i * (2*::core::mem::size_of::<*const u8>()));
            {
              let vec1 = e;
              let ptr1 = vec1.as_ptr().cast::<u8>();
              let len1 = vec1.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len1;
              *base.add(0).cast::<*mut u8>() = ptr1.cast_mut();
            }
          }
          let ptr3 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_4"]
            fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import4(ptr0.cast_mut(), len0, result2, len2, ptr3);
          let l5 = i32::from(*ptr3.add(0).cast::<u8>());
          let result14 = match l5 {
            0 => {
              let e = {
                let l6 = *ptr3.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l7 = *ptr3.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let base12 = l6;
                let len12 = l7;
                let mut result12 = _rt::Vec::with_capacity(len12);
                for i in 0..len12 {
                  let base = base12.add(i * (3*::core::mem::size_of::<*const u8>()));
                  let e12 = {
                    let l8 = i32::from(*base.add(0).cast::<u8>());

                    match l8 {
                      0 => None,
                      1 => {
                        let e = {
                          let l9 = *base.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                          let l10 = *base.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                          let len11 = l10;
                          let bytes11 = _rt::Vec::from_raw_parts(l9.cast(), len11, len11);

                          _rt::string_lift(bytes11)
                        };
                        Some(e)
                      }
                      _ => _rt::invalid_enum_discriminant(),
                    }
                  };
                  result12.push(e12);
                }
                _rt::cabi_dealloc(base12, len12 * (3*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>());

                result12
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l13 = i32::from(*ptr3.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l13 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result14
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn validate_bytes(input: &[u8],) -> ::core::result::Result<(),JsonError>{
        unsafe {

          #[repr(align(1))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let ptr1 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_5"]
            fn wit_import2(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import2(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import2(ptr0.cast_mut(), len0, ptr1);
          let l3 = i32::from(*ptr1.add(0).cast::<u8>());
          let result5 = match l3 {
            0 => {
              let e = ();
              Ok(e)
            }
            1 => {
              let e = {
                let l4 = i32::from(*ptr1.add(1).cast::<u8>());

                JsonError::_lift(l4 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result5
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn select_values(input: &str,pointers: &[_rt::String],) -> ::core::result::Result<_rt::Vec::<SelectedValue>,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec2 = pointers;
          let len2 = vec2.len();
          let layout2 = _rt::alloc::Layout::from_size_align(vec2.len() * (2*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result2, _cleanup2) = wit_bindgen::rt::Cleanup::new(layout2);for (i, e) in vec2.into_iter().enumerate() {
            let base = result2.add(i * (2*::core::mem::size_of::<*const u8>()));
            {
              let vec1 = e;
              let ptr1 = vec1.as_ptr().cast::<u8>();
              let len1 = vec1.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len1;
              *base.add(0).cast::<*mut u8>() = ptr1.cast_mut();
            }
          }
          let ptr3 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_6"]
            fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import4(ptr0.cast_mut(), len0, result2, len2, ptr3);
          let l5 = i32::from(*ptr3.add(0).cast::<u8>());
          let result14 = match l5 {
            0 => {
              let e = {
                let l6 = *ptr3.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l7 = *ptr3.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let base12 = l6;
                let len12 = l7;
                let mut result12 = _rt::Vec::with_capacity(len12);
                for i in 0..len12 {
                  let base = base12.add(i * (3*::core::mem::size_of::<*const u8>()));
                  let e12 = {
                    let l8 = i32::from(*base.add(0).cast::<u8>());
                    let l9 = *base.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                    let l10 = *base.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                    let len11 = l10;
                    let bytes11 = _rt::Vec::from_raw_parts(l9.cast(), len11, len11);

                    SelectedValue{
                      present: _rt::bool_lift(l8 as u8),
                      json: _rt::string_lift(bytes11),
                    }
                  };
                  result12.push(e12);
                }
                _rt::cabi_dealloc(base12, len12 * (3*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>());

                result12
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l13 = i32::from(*ptr3.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l13 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result14
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn select_values_bytes(input: &[u8],pointers: &[_rt::String],) -> ::core::result::Result<_rt::Vec::<SelectedValue>,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec2 = pointers;
          let len2 = vec2.len();
          let layout2 = _rt::alloc::Layout::from_size_align(vec2.len() * (2*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result2, _cleanup2) = wit_bindgen::rt::Cleanup::new(layout2);for (i, e) in vec2.into_iter().enumerate() {
            let base = result2.add(i * (2*::core::mem::size_of::<*const u8>()));
            {
              let vec1 = e;
              let ptr1 = vec1.as_ptr().cast::<u8>();
              let len1 = vec1.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len1;
              *base.add(0).cast::<*mut u8>() = ptr1.cast_mut();
            }
          }
          let ptr3 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_7"]
            fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import4(ptr0.cast_mut(), len0, result2, len2, ptr3);
          let l5 = i32::from(*ptr3.add(0).cast::<u8>());
          let result14 = match l5 {
            0 => {
              let e = {
                let l6 = *ptr3.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l7 = *ptr3.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let base12 = l6;
                let len12 = l7;
                let mut result12 = _rt::Vec::with_capacity(len12);
                for i in 0..len12 {
                  let base = base12.add(i * (3*::core::mem::size_of::<*const u8>()));
                  let e12 = {
                    let l8 = i32::from(*base.add(0).cast::<u8>());
                    let l9 = *base.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                    let l10 = *base.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                    let len11 = l10;
                    let bytes11 = _rt::Vec::from_raw_parts(l9.cast(), len11, len11);

                    SelectedValue{
                      present: _rt::bool_lift(l8 as u8),
                      json: _rt::string_lift(bytes11),
                    }
                  };
                  result12.push(e12);
                }
                _rt::cabi_dealloc(base12, len12 * (3*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>());

                result12
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l13 = i32::from(*ptr3.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l13 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result14
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Same compact parse; return caller fallback on any JsonError.
      #[allow(async_fn_in_trait)]
      pub fn compact_or_bytes(input: &[u8],fallback: &str,) -> _rt::String{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec1 = fallback;
          let ptr1 = vec1.as_ptr().cast::<u8>();
          let len1 = vec1.len();
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_8"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(ptr0.cast_mut(), len0, ptr1.cast_mut(), len1, ptr2);
          let l4 = *ptr2.add(0).cast::<*mut u8>();
          let l5 = *ptr2.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len6 = l5;
          let bytes6 = _rt::Vec::from_raw_parts(l4.cast(), len6, len6);
          let result7 = _rt::string_lift(bytes6);
          result7
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Read a JSON string at a strict pointer; fallback for missing/non-string or JsonError.
      #[allow(async_fn_in_trait)]
      pub fn select_string_or_bytes(input: &[u8],pointer: &str,fallback: &str,) -> _rt::String{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec1 = pointer;
          let ptr1 = vec1.as_ptr().cast::<u8>();
          let len1 = vec1.len();
          let vec2 = fallback;
          let ptr2 = vec2.as_ptr().cast::<u8>();
          let len2 = vec2.len();
          let ptr3 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_9"]
            fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import4(ptr0.cast_mut(), len0, ptr1.cast_mut(), len1, ptr2.cast_mut(), len2, ptr3);
          let l5 = *ptr3.add(0).cast::<*mut u8>();
          let l6 = *ptr3.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len7 = l6;
          let bytes7 = _rt::Vec::from_raw_parts(l5.cast(), len7, len7);
          let result8 = _rt::string_lift(bytes7);
          result8
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Plain record view of the same parse-once selection and documented errors.
      #[allow(async_fn_in_trait)]
      pub fn inspect_values_bytes(input: &[u8],pointers: &[_rt::String],) -> SelectionView{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 4*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 4*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec2 = pointers;
          let len2 = vec2.len();
          let layout2 = _rt::alloc::Layout::from_size_align(vec2.len() * (2*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result2, _cleanup2) = wit_bindgen::rt::Cleanup::new(layout2);for (i, e) in vec2.into_iter().enumerate() {
            let base = result2.add(i * (2*::core::mem::size_of::<*const u8>()));
            {
              let vec1 = e;
              let ptr1 = vec1.as_ptr().cast::<u8>();
              let len1 = vec1.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len1;
              *base.add(0).cast::<*mut u8>() = ptr1.cast_mut();
            }
          }
          let ptr3 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_10"]
            fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import4(ptr0.cast_mut(), len0, result2, len2, ptr3);
          let l5 = i32::from(*ptr3.add(0).cast::<u8>());
          let l6 = *ptr3.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
          let l7 = *ptr3.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
          let base12 = l6;
          let len12 = l7;
          let mut result12 = _rt::Vec::with_capacity(len12);
          for i in 0..len12 {
            let base = base12.add(i * (3*::core::mem::size_of::<*const u8>()));
            let e12 = {
              let l8 = i32::from(*base.add(0).cast::<u8>());
              let l9 = *base.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
              let l10 = *base.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
              let len11 = l10;
              let bytes11 = _rt::Vec::from_raw_parts(l9.cast(), len11, len11);

              SelectedValue{
                present: _rt::bool_lift(l8 as u8),
                json: _rt::string_lift(bytes11),
              }
            };
            result12.push(e12);
          }
          _rt::cabi_dealloc(base12, len12 * (3*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>());
          let l13 = i32::from(*ptr3.add(3*::core::mem::size_of::<*const u8>()).cast::<u8>());
          let result15 = SelectionView{
            valid: _rt::bool_lift(l5 as u8),
            values: result12,
            error: match l13 {
              0 => None,
              1 => {
                let e = {
                  let l14 = i32::from(*ptr3.add(1+3*::core::mem::size_of::<*const u8>()).cast::<u8>());

                  JsonError::_lift(l14 as u8)
                };
                Some(e)
              }
              _ => _rt::invalid_enum_discriminant(),
            },
          };
          result15
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Same Rust text compact, with caller fallback on JsonError.
      #[allow(async_fn_in_trait)]
      pub fn compact_or(input: &str,fallback: &str,) -> _rt::String{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec1 = fallback;
          let ptr1 = vec1.as_ptr().cast::<u8>();
          let len1 = vec1.len();
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_11"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(ptr0.cast_mut(), len0, ptr1.cast_mut(), len1, ptr2);
          let l4 = *ptr2.add(0).cast::<*mut u8>();
          let l5 = *ptr2.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len6 = l5;
          let bytes6 = _rt::Vec::from_raw_parts(l4.cast(), len6, len6);
          let result7 = _rt::string_lift(bytes6);
          result7
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Decode a JSON string; fallback on non-string or JsonError.
      #[allow(async_fn_in_trait)]
      pub fn decode_string_or(input: &str,fallback: &str,) -> _rt::String{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec1 = fallback;
          let ptr1 = vec1.as_ptr().cast::<u8>();
          let len1 = vec1.len();
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_12"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(ptr0.cast_mut(), len0, ptr1.cast_mut(), len1, ptr2);
          let l4 = *ptr2.add(0).cast::<*mut u8>();
          let l5 = *ptr2.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len6 = l5;
          let bytes6 = _rt::Vec::from_raw_parts(l4.cast(), len6, len6);
          let result7 = _rt::string_lift(bytes6);
          result7
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Rust serde_json string serialization, including proper escaping.
      #[allow(async_fn_in_trait)]
      pub fn quote_string(input: &str,) -> _rt::String{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let ptr1 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_13"]
            fn wit_import2(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import2(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import2(ptr0.cast_mut(), len0, ptr1);
          let l3 = *ptr1.add(0).cast::<*mut u8>();
          let l4 = *ptr1.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len5 = l4;
          let bytes5 = _rt::Vec::from_raw_parts(l3.cast(), len5, len5);
          let result6 = _rt::string_lift(bytes5);
          result6
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Values are JSON, not string concatenation. Duplicate keys follow serde_json last-wins semantics.
      #[allow(async_fn_in_trait)]
      pub fn object_from_fields(fields: &[JsonField],) -> ::core::result::Result<_rt::String,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec3 = fields;
          let len3 = vec3.len();
          let layout3 = _rt::alloc::Layout::from_size_align(vec3.len() * (4*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result3, _cleanup3) = wit_bindgen::rt::Cleanup::new(layout3);for (i, e) in vec3.into_iter().enumerate() {
            let base = result3.add(i * (4*::core::mem::size_of::<*const u8>()));
            {
              let JsonField{ name:name0, value_json:value_json0, } = e;
              let vec1 = name0;
              let ptr1 = vec1.as_ptr().cast::<u8>();
              let len1 = vec1.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len1;
              *base.add(0).cast::<*mut u8>() = ptr1.cast_mut();
              let vec2 = value_json0;
              let ptr2 = vec2.as_ptr().cast::<u8>();
              let len2 = vec2.len();
              *base.add(3*::core::mem::size_of::<*const u8>()).cast::<usize>() = len2;
              *base.add(2*::core::mem::size_of::<*const u8>()).cast::<*mut u8>() = ptr2.cast_mut();
            }
          }
          let ptr4 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_14"]
            fn wit_import5(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import5(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import5(result3, len3, ptr4);
          let l6 = i32::from(*ptr4.add(0).cast::<u8>());
          let result11 = match l6 {
            0 => {
              let e = {
                let l7 = *ptr4.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l8 = *ptr4.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let len9 = l8;
                let bytes9 = _rt::Vec::from_raw_parts(l7.cast(), len9, len9);

                _rt::string_lift(bytes9)
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l10 = i32::from(*ptr4.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l10 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result11
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn array_from_values(values: &[_rt::String],) -> ::core::result::Result<_rt::String,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec1 = values;
          let len1 = vec1.len();
          let layout1 = _rt::alloc::Layout::from_size_align(vec1.len() * (2*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result1, _cleanup1) = wit_bindgen::rt::Cleanup::new(layout1);for (i, e) in vec1.into_iter().enumerate() {
            let base = result1.add(i * (2*::core::mem::size_of::<*const u8>()));
            {
              let vec0 = e;
              let ptr0 = vec0.as_ptr().cast::<u8>();
              let len0 = vec0.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len0;
              *base.add(0).cast::<*mut u8>() = ptr0.cast_mut();
            }
          }
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_15"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(result1, len1, ptr2);
          let l4 = i32::from(*ptr2.add(0).cast::<u8>());
          let result9 = match l4 {
            0 => {
              let e = {
                let l5 = *ptr2.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l6 = *ptr2.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let len7 = l6;
                let bytes7 = _rt::Vec::from_raw_parts(l5.cast(), len7, len7);

                _rt::string_lift(bytes7)
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l8 = i32::from(*ptr2.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l8 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result9
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Construct an object or return the caller-supplied fallback on invalid JSON.
      #[allow(async_fn_in_trait)]
      pub fn object_from_fields_or(fields: &[JsonField],fallback: &str,) -> _rt::String{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec3 = fields;
          let len3 = vec3.len();
          let layout3 = _rt::alloc::Layout::from_size_align(vec3.len() * (4*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result3, _cleanup3) = wit_bindgen::rt::Cleanup::new(layout3);for (i, e) in vec3.into_iter().enumerate() {
            let base = result3.add(i * (4*::core::mem::size_of::<*const u8>()));
            {
              let JsonField{ name:name0, value_json:value_json0, } = e;
              let vec1 = name0;
              let ptr1 = vec1.as_ptr().cast::<u8>();
              let len1 = vec1.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len1;
              *base.add(0).cast::<*mut u8>() = ptr1.cast_mut();
              let vec2 = value_json0;
              let ptr2 = vec2.as_ptr().cast::<u8>();
              let len2 = vec2.len();
              *base.add(3*::core::mem::size_of::<*const u8>()).cast::<usize>() = len2;
              *base.add(2*::core::mem::size_of::<*const u8>()).cast::<*mut u8>() = ptr2.cast_mut();
            }
          }
          let vec4 = fallback;
          let ptr4 = vec4.as_ptr().cast::<u8>();
          let len4 = vec4.len();
          let ptr5 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_16"]
            fn wit_import6(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import6(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import6(result3, len3, ptr4.cast_mut(), len4, ptr5);
          let l7 = *ptr5.add(0).cast::<*mut u8>();
          let l8 = *ptr5.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len9 = l8;
          let bytes9 = _rt::Vec::from_raw_parts(l7.cast(), len9, len9);
          let result10 = _rt::string_lift(bytes9);
          result10
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Construct an array or return the caller-supplied fallback on invalid JSON.
      #[allow(async_fn_in_trait)]
      pub fn array_from_values_or(values: &[_rt::String],fallback: &str,) -> _rt::String{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec1 = values;
          let len1 = vec1.len();
          let layout1 = _rt::alloc::Layout::from_size_align(vec1.len() * (2*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result1, _cleanup1) = wit_bindgen::rt::Cleanup::new(layout1);for (i, e) in vec1.into_iter().enumerate() {
            let base = result1.add(i * (2*::core::mem::size_of::<*const u8>()));
            {
              let vec0 = e;
              let ptr0 = vec0.as_ptr().cast::<u8>();
              let len0 = vec0.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len0;
              *base.add(0).cast::<*mut u8>() = ptr0.cast_mut();
            }
          }
          let vec2 = fallback;
          let ptr2 = vec2.as_ptr().cast::<u8>();
          let len2 = vec2.len();
          let ptr3 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_17"]
            fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import4(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import4(result1, len1, ptr2.cast_mut(), len2, ptr3);
          let l5 = *ptr3.add(0).cast::<*mut u8>();
          let l6 = *ptr3.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len7 = l6;
          let bytes7 = _rt::Vec::from_raw_parts(l5.cast(), len7, len7);
          let result8 = _rt::string_lift(bytes7);
          result8
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Parse once; ordered set/remove actions; publish only the complete successful result.
      /// Set inserts/replaces object keys, replaces array items, or appends at '-'. Missing parents fail.
      /// Empty pointer replaces the document; removing the whole document is invalid-operation.
      #[allow(async_fn_in_trait)]
      pub fn edit_bytes(input: &[u8],edits: &[Edit],) -> ::core::result::Result<_rt::Vec::<u8>,JsonError>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec4 = edits;
          let len4 = vec4.len();
          let layout4 = _rt::alloc::Layout::from_size_align(vec4.len() * (5*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result4, _cleanup4) = wit_bindgen::rt::Cleanup::new(layout4);for (i, e) in vec4.into_iter().enumerate() {
            let base = result4.add(i * (5*::core::mem::size_of::<*const u8>()));
            {
              let Edit{ kind:kind1, path:path1, value_json:value_json1, } = e;
              *base.add(0).cast::<u8>() = (kind1.clone() as i32) as u8;
              let vec2 = path1;
              let ptr2 = vec2.as_ptr().cast::<u8>();
              let len2 = vec2.len();
              *base.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>() = len2;
              *base.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>() = ptr2.cast_mut();
              let vec3 = value_json1;
              let ptr3 = vec3.as_ptr().cast::<u8>();
              let len3 = vec3.len();
              *base.add(4*::core::mem::size_of::<*const u8>()).cast::<usize>() = len3;
              *base.add(3*::core::mem::size_of::<*const u8>()).cast::<*mut u8>() = ptr3.cast_mut();
            }
          }
          let ptr5 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_18"]
            fn wit_import6(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import6(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import6(ptr0.cast_mut(), len0, result4, len4, ptr5);
          let l7 = i32::from(*ptr5.add(0).cast::<u8>());
          let result12 = match l7 {
            0 => {
              let e = {
                let l8 = *ptr5.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>();
                let l9 = *ptr5.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>();
                let len10 = l9;

                <_ as From<_rt::Vec<_>>>::from(_rt::Vec::from_raw_parts(l8.cast(), len10, len10))
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l11 = i32::from(*ptr5.add(::core::mem::size_of::<*const u8>()).cast::<u8>());

                JsonError::_lift(l11 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result12
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Apply ordered edits and return JSON text, or the caller's fallback if any edit fails.
      /// Use edit-bytes when the precise error is needed.
      #[allow(async_fn_in_trait)]
      pub fn edit_or_bytes(input: &[u8],edits: &[Edit],fallback: &str,) -> _rt::String{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec4 = edits;
          let len4 = vec4.len();
          let layout4 = _rt::alloc::Layout::from_size_align(vec4.len() * (5*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result4, _cleanup4) = wit_bindgen::rt::Cleanup::new(layout4);for (i, e) in vec4.into_iter().enumerate() {
            let base = result4.add(i * (5*::core::mem::size_of::<*const u8>()));
            {
              let Edit{ kind:kind1, path:path1, value_json:value_json1, } = e;
              *base.add(0).cast::<u8>() = (kind1.clone() as i32) as u8;
              let vec2 = path1;
              let ptr2 = vec2.as_ptr().cast::<u8>();
              let len2 = vec2.len();
              *base.add(2*::core::mem::size_of::<*const u8>()).cast::<usize>() = len2;
              *base.add(::core::mem::size_of::<*const u8>()).cast::<*mut u8>() = ptr2.cast_mut();
              let vec3 = value_json1;
              let ptr3 = vec3.as_ptr().cast::<u8>();
              let len3 = vec3.len();
              *base.add(4*::core::mem::size_of::<*const u8>()).cast::<usize>() = len3;
              *base.add(3*::core::mem::size_of::<*const u8>()).cast::<*mut u8>() = ptr3.cast_mut();
            }
          }
          let vec5 = fallback;
          let ptr5 = vec5.as_ptr().cast::<u8>();
          let len5 = vec5.len();
          let ptr6 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_19"]
            fn wit_import7(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import7(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import7(ptr0.cast_mut(), len0, result4, len4, ptr5.cast_mut(), len5, ptr6);
          let l8 = *ptr6.add(0).cast::<*mut u8>();
          let l9 = *ptr6.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len10 = l9;
          let bytes10 = _rt::Vec::from_raw_parts(l8.cast(), len10, len10);
          let result11 = _rt::string_lift(bytes10);
          result11
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Missing has present=false. Null and wrong types are errors, not missing.
      #[allow(async_fn_in_trait)]
      pub fn read_u64(input: &[u8],pointer: &str,) -> ::core::result::Result<UnsignedValue,JsonError>{
        unsafe {

          #[repr(align(8))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 24]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 24]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec1 = pointer;
          let ptr1 = vec1.as_ptr().cast::<u8>();
          let len1 = vec1.len();
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_20"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(ptr0.cast_mut(), len0, ptr1.cast_mut(), len1, ptr2);
          let l4 = i32::from(*ptr2.add(0).cast::<u8>());
          let result8 = match l4 {
            0 => {
              let e = {
                let l5 = i32::from(*ptr2.add(8).cast::<u8>());
                let l6 = *ptr2.add(16).cast::<i64>();

                UnsignedValue{
                  present: _rt::bool_lift(l5 as u8),
                  value: l6 as u64,
                }
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l7 = i32::from(*ptr2.add(8).cast::<u8>());

                JsonError::_lift(l7 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result8
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn read_i64(input: &[u8],pointer: &str,) -> ::core::result::Result<SignedValue,JsonError>{
        unsafe {

          #[repr(align(8))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 24]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 24]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec1 = pointer;
          let ptr1 = vec1.as_ptr().cast::<u8>();
          let len1 = vec1.len();
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_21"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(ptr0.cast_mut(), len0, ptr1.cast_mut(), len1, ptr2);
          let l4 = i32::from(*ptr2.add(0).cast::<u8>());
          let result8 = match l4 {
            0 => {
              let e = {
                let l5 = i32::from(*ptr2.add(8).cast::<u8>());
                let l6 = *ptr2.add(16).cast::<i64>();

                SignedValue{
                  present: _rt::bool_lift(l5 as u8),
                  value: l6,
                }
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l7 = i32::from(*ptr2.add(8).cast::<u8>());

                JsonError::_lift(l7 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result8
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Matches serde_json Number::as_f64, including its documented integer-to-float conversion.
      #[allow(async_fn_in_trait)]
      pub fn read_f64(input: &[u8],pointer: &str,) -> ::core::result::Result<FloatValue,JsonError>{
        unsafe {

          #[repr(align(8))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 24]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 24]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec1 = pointer;
          let ptr1 = vec1.as_ptr().cast::<u8>();
          let len1 = vec1.len();
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_22"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(ptr0.cast_mut(), len0, ptr1.cast_mut(), len1, ptr2);
          let l4 = i32::from(*ptr2.add(0).cast::<u8>());
          let result8 = match l4 {
            0 => {
              let e = {
                let l5 = i32::from(*ptr2.add(8).cast::<u8>());
                let l6 = *ptr2.add(16).cast::<f64>();

                FloatValue{
                  present: _rt::bool_lift(l5 as u8),
                  value: l6,
                }
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l7 = i32::from(*ptr2.add(8).cast::<u8>());

                JsonError::_lift(l7 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result8
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn read_bool(input: &[u8],pointer: &str,) -> ::core::result::Result<BooleanValue,JsonError>{
        unsafe {

          #[repr(align(1))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 3]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 3]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let vec1 = pointer;
          let ptr1 = vec1.as_ptr().cast::<u8>();
          let len1 = vec1.len();
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_23"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(ptr0.cast_mut(), len0, ptr1.cast_mut(), len1, ptr2);
          let l4 = i32::from(*ptr2.add(0).cast::<u8>());
          let result8 = match l4 {
            0 => {
              let e = {
                let l5 = i32::from(*ptr2.add(1).cast::<u8>());
                let l6 = i32::from(*ptr2.add(2).cast::<u8>());

                BooleanValue{
                  present: _rt::bool_lift(l5 as u8),
                  value: _rt::bool_lift(l6 as u8),
                }
              };
              Ok(e)
            }
            1 => {
              let e = {
                let l7 = i32::from(*ptr2.add(1).cast::<u8>());

                JsonError::_lift(l7 as u8)
              };
              Err(e)
            }
            _ => _rt::invalid_enum_discriminant(),
          };
          result8
        }
      }

    }


    #[allow(dead_code, async_fn_in_trait, unused_imports, clippy::all)]
    pub mod utf8 {
      
      use super::super::super::_rt;
      #[allow(unused_unsafe, clippy::all)]
      #[allow(async_fn_in_trait)]
      pub fn encode(input: &str,) -> _rt::Vec::<u8>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec0 = input;
          let ptr0 = vec0.as_ptr().cast::<u8>();
          let len0 = vec0.len();
          let ptr1 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_24"]
            fn wit_import2(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import2(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import2(ptr0.cast_mut(), len0, ptr1);
          let l3 = *ptr1.add(0).cast::<*mut u8>();
          let l4 = *ptr1.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len5 = l4;
          let result6 = <_ as From<_rt::Vec<_>>>::from(_rt::Vec::from_raw_parts(l3.cast(), len5, len5));
          result6
        }
      }
      #[allow(unused_unsafe, clippy::all)]
      /// Concatenate exact UTF8 bytes in order. No per-Lib byte or part-count quota.
      #[allow(async_fn_in_trait)]
      pub fn encode_parts(parts: &[_rt::String],) -> _rt::Vec::<u8>{
        unsafe {

          #[cfg_attr(target_pointer_width="64", repr(align(8)))]
          #[cfg_attr(target_pointer_width="32", repr(align(4)))]
          struct RetArea([::core::mem::MaybeUninit::<u8>; 2*::core::mem::size_of::<*const u8>()]);
          let mut ret_area = RetArea([::core::mem::MaybeUninit::uninit(); 2*::core::mem::size_of::<*const u8>()]);
          let vec1 = parts;
          let len1 = vec1.len();
          let layout1 = _rt::alloc::Layout::from_size_align(vec1.len() * (2*::core::mem::size_of::<*const u8>()), ::core::mem::size_of::<*const u8>()).unwrap();
          let (result1, _cleanup1) = wit_bindgen::rt::Cleanup::new(layout1);for (i, e) in vec1.into_iter().enumerate() {
            let base = result1.add(i * (2*::core::mem::size_of::<*const u8>()));
            {
              let vec0 = e;
              let ptr0 = vec0.as_ptr().cast::<u8>();
              let len0 = vec0.len();
              *base.add(::core::mem::size_of::<*const u8>()).cast::<usize>() = len0;
              *base.add(0).cast::<*mut u8>() = ptr0.cast_mut();
            }
          }
          let ptr2 = ret_area.0.as_mut_ptr().cast::<u8>();
          #[cfg(target_arch = "wasm32")]
          
          unsafe extern "C" {
            #[link_name = "__wasmc_canonical_bridge_25"]
            fn wit_import3(_: *mut u8, _: usize, _: *mut u8, );
          }

          #[cfg(not(target_arch = "wasm32"))]
          unsafe extern "C" fn wit_import3(_: *mut u8, _: usize, _: *mut u8, ) { unreachable!() }
          wit_import3(result1, len1, ptr2);
          let l4 = *ptr2.add(0).cast::<*mut u8>();
          let l5 = *ptr2.add(::core::mem::size_of::<*const u8>()).cast::<usize>();
          let len6 = l5;
          let result7 = <_ as From<_rt::Vec<_>>>::from(_rt::Vec::from_raw_parts(l4.cast(), len6, len6));
          result7
        }
      }

    }

  }
}
mod _rt {
  #![allow(dead_code, unused_imports, clippy::all)]
  pub use alloc_crate::string::String;
  pub use alloc_crate::vec::Vec;
  pub unsafe fn string_lift(bytes: Vec<u8>) -> String {
    if cfg!(debug_assertions) {
      String::from_utf8(bytes).unwrap()
    } else {
      unsafe { String::from_utf8_unchecked(bytes) }
    }
  }
  pub unsafe fn invalid_enum_discriminant<T>() -> T {
    if cfg!(debug_assertions) {
      panic!("invalid enum discriminant")
    } else {
      unsafe { core::hint::unreachable_unchecked() }
    }
  }
  pub use alloc_crate::alloc;
  pub unsafe fn cabi_dealloc(ptr: *mut u8, size: usize, align: usize) {
    if size == 0 {
      return;
    }
    unsafe {
      let layout = alloc::Layout::from_size_align_unchecked(size, align);
      alloc::dealloc(ptr, layout);
    }
  }
  pub unsafe fn bool_lift(val: u8) -> bool {
    if cfg!(debug_assertions) {
      match val {
        0 => false,
        1 => true,
        _ => panic!("invalid bool discriminant"),
      }
    } else {
      val != 0
    }
  }
  extern crate alloc as alloc_crate;
}

#[cfg(target_arch = "wasm32")]
#[unsafe(link_section = "component-type:wit-bindgen:0.62.0:wasmc:json@0.2.4:json:encoded world")]
#[doc(hidden)]
#[allow(clippy::octal_escapes)]
pub static __WIT_BINDGEN_COMPONENT_TYPE: [u8; 1717] = *b"\
\0asm\x0d\0\x01\0\0\x19\x16wit-component-encoding\x04\0\x07\xba\x0c\x01A\x02\x01\
A\x04\x01BT\x01m\x08\x0cinvalid-json\x0finvalid-pointer\x0emissing-target\x0dtyp\
e-mismatch\x0dinvalid-index\x0cout-of-range\x11invalid-operation\x11allocation-f\
ailed\x04\0\x0ajson-error\x03\0\0\x01r\x02\x07present\x7f\x04jsons\x04\0\x0esele\
cted-value\x03\0\x02\x01p\x03\x01k\x01\x01r\x03\x05valid\x7f\x06values\x04\x05er\
ror\x05\x04\0\x0eselection-view\x03\0\x06\x01r\x02\x04names\x0avalue-jsons\x04\0\
\x0ajson-field\x03\0\x08\x01m\x02\x03set\x06remove\x04\0\x09edit-kind\x03\0\x0a\x01\
r\x03\x04kind\x0b\x04paths\x0avalue-jsons\x04\0\x04edit\x03\0\x0c\x01r\x02\x07pr\
esent\x7f\x05valuew\x04\0\x0eunsigned-value\x03\0\x0e\x01r\x02\x07present\x7f\x05\
valuex\x04\0\x0csigned-value\x03\0\x10\x01r\x02\x07present\x7f\x05valueu\x04\0\x0b\
float-value\x03\0\x12\x01r\x02\x07present\x7f\x05value\x7f\x04\0\x0dboolean-valu\
e\x03\0\x14\x01j\x01s\x01\x01\x01@\x01\x05inputs\0\x16\x04\0\x07compact\x01\x17\x01\
ps\x01ks\x01p\x19\x01j\x01\x1a\x01\x01\x01@\x02\x05inputs\x08pointers\x18\0\x1b\x04\
\0\x06select\x01\x1c\x01j\0\x01\x01\x01@\x01\x05inputs\0\x1d\x04\0\x08validate\x01\
\x1e\x01p}\x01@\x01\x05input\x1f\0\x16\x04\0\x0dcompact-bytes\x01\x20\x01@\x02\x05\
input\x1f\x08pointers\x18\0\x1b\x04\0\x0cselect-bytes\x01!\x01@\x01\x05input\x1f\
\0\x1d\x04\0\x0evalidate-bytes\x01\"\x01j\x01\x04\x01\x01\x01@\x02\x05inputs\x08\
pointers\x18\0#\x04\0\x0dselect-values\x01$\x01@\x02\x05input\x1f\x08pointers\x18\
\0#\x04\0\x13select-values-bytes\x01%\x01@\x02\x05input\x1f\x08fallbacks\0s\x04\0\
\x10compact-or-bytes\x01&\x01@\x03\x05input\x1f\x07pointers\x08fallbacks\0s\x04\0\
\x16select-string-or-bytes\x01'\x01@\x02\x05input\x1f\x08pointers\x18\0\x07\x04\0\
\x14inspect-values-bytes\x01(\x01@\x02\x05inputs\x08fallbacks\0s\x04\0\x0acompac\
t-or\x01)\x04\0\x10decode-string-or\x01)\x01@\x01\x05inputs\0s\x04\0\x0cquote-st\
ring\x01*\x01p\x09\x01@\x01\x06fields+\0\x16\x04\0\x12object-from-fields\x01,\x01\
@\x01\x06values\x18\0\x16\x04\0\x11array-from-values\x01-\x01@\x02\x06fields+\x08\
fallbacks\0s\x04\0\x15object-from-fields-or\x01.\x01@\x02\x06values\x18\x08fallb\
acks\0s\x04\0\x14array-from-values-or\x01/\x01p\x0d\x01j\x01\x1f\x01\x01\x01@\x02\
\x05input\x1f\x05edits0\01\x04\0\x0aedit-bytes\x012\x01@\x03\x05input\x1f\x05edi\
ts0\x08fallbacks\0s\x04\0\x0dedit-or-bytes\x013\x01j\x01\x0f\x01\x01\x01@\x02\x05\
input\x1f\x07pointers\04\x04\0\x08read-u64\x015\x01j\x01\x11\x01\x01\x01@\x02\x05\
input\x1f\x07pointers\06\x04\0\x08read-i64\x017\x01j\x01\x13\x01\x01\x01@\x02\x05\
input\x1f\x07pointers\08\x04\0\x08read-f64\x019\x01j\x01\x15\x01\x01\x01@\x02\x05\
input\x1f\x07pointers\0:\x04\0\x09read-bool\x01;\x03\0\x19wasmc:json/document@0.\
2.4\x05\0\x01B\x06\x01p}\x01@\x01\x05inputs\0\0\x04\0\x06encode\x01\x01\x01ps\x01\
@\x01\x05parts\x02\0\0\x04\0\x0cencode-parts\x01\x03\x03\0\x15wasmc:json/utf8@0.\
2.4\x05\x01\x04\0\x15wasmc:json/json@0.2.4\x04\0\x0b\x0a\x01\0\x04json\x03\0\0\0\
G\x09producers\x01\x0cprocessed-by\x02\x0dwit-component\x070.259.0\x10wit-bindge\
n-rust\x060.62.0";

#[cfg(target_arch="wasm32")]

#[allow(dead_code,unused_variables)]
mod __wasmc_canonical_transfer {
use std::alloc::{Layout,alloc_zeroed,dealloc};
#[link(wasm_import_module="wasmc:private/canonical-memory@1")]
unsafe extern "C" {
 fn read8(p:i32)->i32;fn read32(p:i32)->i32;fn read64(p:i32)->i64;
 fn write8(p:i32,v:i32);fn write32(p:i32,v:i32);fn write64(p:i32,v:i64);
 fn own_read8(p:i32)->i32;fn own_read32(p:i32)->i32;fn own_read64(p:i32)->i64;
 fn own_write8(p:i32,v:i32);fn own_write32(p:i32,v:i32);fn own_write64(p:i32,v:i64);
 fn own_memory_size()->i32;fn lib_memory_size()->i32;
 fn copy_to_lib(d:i32,s:i32,n:i32);fn copy_from_lib(d:i32,s:i32,n:i32);
}
fn add(p:u32,n:u32)->u32{p.checked_add(n).expect("pointer overflow")}
fn range(lib:bool,p:u32,n:u32,a:u32){assert!(a.is_power_of_two()&&p%a==0);let pages=unsafe{if lib{lib_memory_size()}else{own_memory_size()}} as u32 as u64;assert!((p as u64)+(n as u64)<=pages*65536);}
fn r(lib:bool,p:u32,n:u32)->u64{range(lib,p,n,1);unsafe{match n{1=>if lib{read8(p as i32) as u32 as u64}else{own_read8(p as i32) as u32 as u64},2=>r(lib,p,1)|(r(lib,add(p,1),1)<<8),4=>if lib{read32(p as i32) as u32 as u64}else{own_read32(p as i32) as u32 as u64},8=>if lib{read64(p as i32) as u64}else{own_read64(p as i32) as u64},_=>panic!("read width")}}}
fn w(lib:bool,p:u32,x:u64,n:u32){range(lib,p,n,1);unsafe{match n{1=>if lib{write8(p as i32,x as i32)}else{own_write8(p as i32,x as i32)},2=>{w(lib,p,x,1);w(lib,add(p,1),x>>8,1)},4=>if lib{write32(p as i32,x as i32)}else{own_write32(p as i32,x as i32)},8=>if lib{write64(p as i32,x as i64)}else{own_write64(p as i32,x as i64)},_=>panic!("write width")}}}
fn zero(lib:bool,p:u32,n:u32){range(lib,p,n,1);if lib && n>0{let z=vec![0u8;n.min(65536) as usize];let mut i=0;while i<n{let k=(n-i).min(z.len() as u32);unsafe{copy_to_lib(add(p,i) as i32,z.as_ptr() as usize as i32,k as i32);}i+=k;}}else{for i in 0..n{w(lib,add(p,i),0,1);}}}
fn blit(from:bool,to:bool,s:u32,d:u32,n:u32){range(from,s,n,1);range(to,d,n,1);if from==to{if s!=d{for i in 0..n{w(to,add(d,i),r(from,add(s,i),1),1);}}}else{unsafe{if from{copy_from_lib(d as i32,s as i32,n as i32)}else{copy_to_lib(d as i32,s as i32,n as i32)}}}}
fn allocate(lib:bool,n:u32,a:u32)->u32{if n==0{return a;}let p=if lib{unsafe{realloc(0,0,a as i32,n as i32) as u32}}else{let l=Layout::from_size_align(n as usize,a as usize).unwrap();let p=unsafe{alloc_zeroed(l)};assert!(!p.is_null());p as usize as u32};range(lib,p,n,a);if lib{zero(true,p,n);}p}
struct Scratch{p:u32,l:Layout}
impl Scratch{fn new(n:u32,a:u32)->Self{let l=Layout::from_size_align(n.max(1) as usize,a as usize).unwrap();let p=allocate(false,n.max(1),a);Self{p,l}}}
impl Drop for Scratch{fn drop(&mut self){unsafe{dealloc(self.p as usize as *mut u8,self.l);}}}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")] unsafe extern "C" {#[link_name="cabi_realloc"]fn realloc(p:i32,n:i32,a:i32,m:i32)->i32;}
fn c_bool(s:u32,d:u32,from:bool,to:bool){range(from,s,1,1);range(to,d,1,1);let x=r(from,s,1);assert!(x<=1);w(to,d,x,1);}
fn c_u8(s:u32,d:u32,from:bool,to:bool){range(from,s,1,1);range(to,d,1,1);blit(from,to,s,d,1);}
fn c_s8(s:u32,d:u32,from:bool,to:bool){range(from,s,1,1);range(to,d,1,1);blit(from,to,s,d,1);}
fn c_u16(s:u32,d:u32,from:bool,to:bool){range(from,s,2,2);range(to,d,2,2);blit(from,to,s,d,2);}
fn c_s16(s:u32,d:u32,from:bool,to:bool){range(from,s,2,2);range(to,d,2,2);blit(from,to,s,d,2);}
fn c_u32(s:u32,d:u32,from:bool,to:bool){range(from,s,4,4);range(to,d,4,4);blit(from,to,s,d,4);}
fn c_s32(s:u32,d:u32,from:bool,to:bool){range(from,s,4,4);range(to,d,4,4);blit(from,to,s,d,4);}
fn c_u64(s:u32,d:u32,from:bool,to:bool){range(from,s,8,8);range(to,d,8,8);blit(from,to,s,d,8);}
fn c_s64(s:u32,d:u32,from:bool,to:bool){range(from,s,8,8);range(to,d,8,8);blit(from,to,s,d,8);}
fn c_f32(s:u32,d:u32,from:bool,to:bool){range(from,s,4,4);range(to,d,4,4);blit(from,to,s,d,4);}
fn c_f64(s:u32,d:u32,from:bool,to:bool){range(from,s,8,8);range(to,d,8,8);blit(from,to,s,d,8);}
fn c_char(s:u32,d:u32,from:bool,to:bool){range(from,s,4,4);range(to,d,4,4);let x=r(from,s,4);assert!(char::from_u32(x as u32).is_some());w(to,d,x,4);}
fn c_string(s:u32,d:u32,from:bool,to:bool){range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;range(from,p,n,1);let mut v=Vec::with_capacity(n as usize);for i in 0..n{v.push(r(from,add(p,i),1) as u8);}assert!(std::str::from_utf8(&v).is_ok());let q=allocate(!from,n,1);blit(from,!from,p,q,n);w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);}
fn c0(s:u32,d:u32,from:bool,to:bool){range(from,s,1,1);range(to,d,1,1);let x=r(from,s,1);assert!(x<8);w(to,d,x,1);}
fn c1(s:u32,d:u32,from:bool,to:bool){range(from,s,12,4);range(to,d,12,4);c_bool(add(s,0),add(d,0),from,to);c_string(add(s,4),add(d,4),from,to);}
fn c2(s:u32,d:u32,from:bool,to:bool){range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;let bytes=n.checked_mul(12).expect("list size");range(from,p,bytes,4);let q=allocate(!from,bytes,4);for i in 0..n{c1(add(p,i*12),add(q,i*12),from,!from);}w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);}
fn c3(s:u32,d:u32,from:bool,to:bool){range(from,s,2,1);range(to,d,2,1);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{},1=>{c0(add(s,1),add(d,1),from,to);},_=>unreachable!()};}
fn c4(s:u32,d:u32,from:bool,to:bool){range(from,s,16,4);range(to,d,16,4);c_bool(add(s,0),add(d,0),from,to);c2(add(s,4),add(d,4),from,to);c3(add(s,12),add(d,12),from,to);}
fn c5(s:u32,d:u32,from:bool,to:bool){range(from,s,16,4);range(to,d,16,4);c_string(add(s,0),add(d,0),from,to);c_string(add(s,8),add(d,8),from,to);}
fn c6(s:u32,d:u32,from:bool,to:bool){range(from,s,1,1);range(to,d,1,1);let x=r(from,s,1);assert!(x<2);w(to,d,x,1);}
fn c7(s:u32,d:u32,from:bool,to:bool){range(from,s,20,4);range(to,d,20,4);c6(add(s,0),add(d,0),from,to);c_string(add(s,4),add(d,4),from,to);c_string(add(s,12),add(d,12),from,to);}
fn c8(s:u32,d:u32,from:bool,to:bool){range(from,s,16,8);range(to,d,16,8);c_bool(add(s,0),add(d,0),from,to);c_u64(add(s,8),add(d,8),from,to);}
fn c9(s:u32,d:u32,from:bool,to:bool){range(from,s,16,8);range(to,d,16,8);c_bool(add(s,0),add(d,0),from,to);c_s64(add(s,8),add(d,8),from,to);}
fn c10(s:u32,d:u32,from:bool,to:bool){range(from,s,16,8);range(to,d,16,8);c_bool(add(s,0),add(d,0),from,to);c_f64(add(s,8),add(d,8),from,to);}
fn c11(s:u32,d:u32,from:bool,to:bool){range(from,s,2,1);range(to,d,2,1);c_bool(add(s,0),add(d,0),from,to);c_bool(add(s,1),add(d,1),from,to);}
fn c12(s:u32,d:u32,from:bool,to:bool){range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c_string(add(s,4),add(d,4),from,to);},1=>{c0(add(s,4),add(d,4),from,to);},_=>unreachable!()};}
fn c13(s:u32,d:u32,from:bool,to:bool){range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;let bytes=n.checked_mul(8).expect("list size");range(from,p,bytes,4);let q=allocate(!from,bytes,4);for i in 0..n{c_string(add(p,i*8),add(q,i*8),from,!from);}w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);}
fn c14(s:u32,d:u32,from:bool,to:bool){range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{},1=>{c_string(add(s,4),add(d,4),from,to);},_=>unreachable!()};}
fn c15(s:u32,d:u32,from:bool,to:bool){range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;let bytes=n.checked_mul(12).expect("list size");range(from,p,bytes,4);let q=allocate(!from,bytes,4);for i in 0..n{c14(add(p,i*12),add(q,i*12),from,!from);}w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);}
fn c16(s:u32,d:u32,from:bool,to:bool){range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c15(add(s,4),add(d,4),from,to);},1=>{c0(add(s,4),add(d,4),from,to);},_=>unreachable!()};}
fn c17(s:u32,d:u32,from:bool,to:bool){range(from,s,2,1);range(to,d,2,1);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{},1=>{c0(add(s,1),add(d,1),from,to);},_=>unreachable!()};}
fn c18(s:u32,d:u32,from:bool,to:bool){range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;let bytes=n.checked_mul(1).expect("list size");range(from,p,bytes,1);let q=allocate(!from,bytes,1);blit(from,!from,p,q,bytes);w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);}
fn c19(s:u32,d:u32,from:bool,to:bool){range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c2(add(s,4),add(d,4),from,to);},1=>{c0(add(s,4),add(d,4),from,to);},_=>unreachable!()};}
fn c20(s:u32,d:u32,from:bool,to:bool){range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;let bytes=n.checked_mul(16).expect("list size");range(from,p,bytes,4);let q=allocate(!from,bytes,4);for i in 0..n{c5(add(p,i*16),add(q,i*16),from,!from);}w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);}
fn c21(s:u32,d:u32,from:bool,to:bool){range(from,s,8,4);range(to,d,8,4);let p=r(from,s,4) as u32;let n=r(from,add(s,4),4) as u32;let bytes=n.checked_mul(20).expect("list size");range(from,p,bytes,4);let q=allocate(!from,bytes,4);for i in 0..n{c7(add(p,i*20),add(q,i*20),from,!from);}w(to,d,q as u64,4);w(to,add(d,4),n as u64,4);}
fn c22(s:u32,d:u32,from:bool,to:bool){range(from,s,12,4);range(to,d,12,4);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c18(add(s,4),add(d,4),from,to);},1=>{c0(add(s,4),add(d,4),from,to);},_=>unreachable!()};}
fn c23(s:u32,d:u32,from:bool,to:bool){range(from,s,24,8);range(to,d,24,8);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c8(add(s,8),add(d,8),from,to);},1=>{c0(add(s,8),add(d,8),from,to);},_=>unreachable!()};}
fn c24(s:u32,d:u32,from:bool,to:bool){range(from,s,24,8);range(to,d,24,8);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c9(add(s,8),add(d,8),from,to);},1=>{c0(add(s,8),add(d,8),from,to);},_=>unreachable!()};}
fn c25(s:u32,d:u32,from:bool,to:bool){range(from,s,24,8);range(to,d,24,8);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c10(add(s,8),add(d,8),from,to);},1=>{c0(add(s,8),add(d,8),from,to);},_=>unreachable!()};}
fn c26(s:u32,d:u32,from:bool,to:bool){range(from,s,3,1);range(to,d,3,1);let tag=r(from,s,1);assert!(tag<2);w(to,d,tag,1);match tag{0=>{c11(add(s,1),add(d,1),from,to);},1=>{c0(add(s,1),add(d,1),from,to);},_=>unreachable!()};}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#compact"]fn raw0(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#compact"]fn post0(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_0(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false);let result=raw0(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,12,4);zero(false,dst,12);c12(result as u32,dst,true,false);post0(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#select"]fn raw1(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#select"]fn post1(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_1(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false);c13(add(args.p,8),add(args.p,8),false,false);let result=raw1(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c16(result as u32,dst,true,false);post1(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#validate"]fn raw2(p0:i32,p1:i32)->i32;}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_2(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false);let result=raw2(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,2,1);zero(false,dst,2);c17(result as u32,dst,true,false);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#compact-bytes"]fn raw3(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#compact-bytes"]fn post3(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_3(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);let result=raw3(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,12,4);zero(false,dst,12);c12(result as u32,dst,true,false);post3(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#select-bytes"]fn raw4(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#select-bytes"]fn post4(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_4(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c13(add(args.p,8),add(args.p,8),false,false);let result=raw4(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c16(result as u32,dst,true,false);post4(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#validate-bytes"]fn raw5(p0:i32,p1:i32)->i32;}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_5(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);let result=raw5(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,2,1);zero(false,dst,2);c17(result as u32,dst,true,false);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#select-values"]fn raw6(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#select-values"]fn post6(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_6(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false);c13(add(args.p,8),add(args.p,8),false,false);let result=raw6(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c19(result as u32,dst,true,false);post6(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#select-values-bytes"]fn raw7(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#select-values-bytes"]fn post7(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_7(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c13(add(args.p,8),add(args.p,8),false,false);let result=raw7(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c19(result as u32,dst,true,false);post7(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#compact-or-bytes"]fn raw8(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#compact-or-bytes"]fn post8(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_8(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw8(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false);post8(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#select-string-or-bytes"]fn raw9(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32,p5:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#select-string-or-bytes"]fn post9(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_9(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32,p5:i32,p6:i32){let args=Scratch::new(24, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);w(false,add(args.p,16),(p4) as u32 as u64,4);w(false,add(add(args.p,16),4),(p5) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);c_string(add(args.p,16),add(args.p,16),false,false);let result=raw9(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32,r(false,add(args.p,16),4) as i32,r(false,add(add(args.p,16),4),4) as i32);let dst=p6 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false);post9(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#inspect-values-bytes"]fn raw10(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#inspect-values-bytes"]fn post10(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_10(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c13(add(args.p,8),add(args.p,8),false,false);let result=raw10(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,16,4);zero(false,dst,16);c4(result as u32,dst,true,false);post10(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#compact-or"]fn raw11(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#compact-or"]fn post11(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_11(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw11(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false);post11(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#decode-string-or"]fn raw12(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#decode-string-or"]fn post12(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_12(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw12(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false);post12(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#quote-string"]fn raw13(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#quote-string"]fn post13(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_13(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false);let result=raw13(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false);post13(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#object-from-fields"]fn raw14(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#object-from-fields"]fn post14(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_14(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c20(add(args.p,0),add(args.p,0),false,false);let result=raw14(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,12,4);zero(false,dst,12);c12(result as u32,dst,true,false);post14(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#array-from-values"]fn raw15(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#array-from-values"]fn post15(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_15(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c13(add(args.p,0),add(args.p,0),false,false);let result=raw15(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,12,4);zero(false,dst,12);c12(result as u32,dst,true,false);post15(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#object-from-fields-or"]fn raw16(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#object-from-fields-or"]fn post16(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_16(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c20(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw16(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false);post16(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#array-from-values-or"]fn raw17(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#array-from-values-or"]fn post17(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_17(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c13(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw17(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false);post17(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#edit-bytes"]fn raw18(p0:i32,p1:i32,p2:i32,p3:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#edit-bytes"]fn post18(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_18(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c21(add(args.p,8),add(args.p,8),false,false);let result=raw18(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,12,4);zero(false,dst,12);c22(result as u32,dst,true,false);post18(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#edit-or-bytes"]fn raw19(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32,p5:i32)->i32;#[link_name="cabi_post_wasmc:json/document@0.2.4#edit-or-bytes"]fn post19(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_19(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32,p5:i32,p6:i32){let args=Scratch::new(24, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);w(false,add(args.p,16),(p4) as u32 as u64,4);w(false,add(add(args.p,16),4),(p5) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c21(add(args.p,8),add(args.p,8),false,false);c_string(add(args.p,16),add(args.p,16),false,false);let result=raw19(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32,r(false,add(args.p,16),4) as i32,r(false,add(add(args.p,16),4),4) as i32);let dst=p6 as u32;range(false,dst,8,4);zero(false,dst,8);c_string(result as u32,dst,true,false);post19(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#read-u64"]fn raw20(p0:i32,p1:i32,p2:i32,p3:i32)->i32;}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_20(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw20(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,24,8);zero(false,dst,24);c23(result as u32,dst,true,false);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#read-i64"]fn raw21(p0:i32,p1:i32,p2:i32,p3:i32)->i32;}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_21(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw21(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,24,8);zero(false,dst,24);c24(result as u32,dst,true,false);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#read-f64"]fn raw22(p0:i32,p1:i32,p2:i32,p3:i32)->i32;}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_22(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw22(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,24,8);zero(false,dst,24);c25(result as u32,dst,true,false);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/document@0.2.4#read-bool"]fn raw23(p0:i32,p1:i32,p2:i32,p3:i32)->i32;}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_23(p0:i32,p1:i32,p2:i32,p3:i32,p4:i32){let args=Scratch::new(16, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);w(false,add(args.p,8),(p2) as u32 as u64,4);w(false,add(add(args.p,8),4),(p3) as u32 as u64,4);c18(add(args.p,0),add(args.p,0),false,false);c_string(add(args.p,8),add(args.p,8),false,false);let result=raw23(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32,r(false,add(args.p,8),4) as i32,r(false,add(add(args.p,8),4),4) as i32);let dst=p4 as u32;range(false,dst,3,1);zero(false,dst,3);c26(result as u32,dst,true,false);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/utf8@0.2.4#encode"]fn raw24(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/utf8@0.2.4#encode"]fn post24(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_24(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c_string(add(args.p,0),add(args.p,0),false,false);let result=raw24(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,8,4);zero(false,dst,8);c18(result as u32,dst,true,false);post24(result as i32);}
#[link(wasm_import_module="wasmc:lib/wasmc-json@0.2.4")]unsafe extern "C"{#[link_name="wasmc:json/utf8@0.2.4#encode-parts"]fn raw25(p0:i32,p1:i32)->i32;#[link_name="cabi_post_wasmc:json/utf8@0.2.4#encode-parts"]fn post25(p:i32);}
#[unsafe(no_mangle)]pub unsafe extern "C" fn __wasmc_canonical_bridge_25(p0:i32,p1:i32,p2:i32){let args=Scratch::new(8, 4);w(false,add(args.p,0),(p0) as u32 as u64,4);w(false,add(add(args.p,0),4),(p1) as u32 as u64,4);c13(add(args.p,0),add(args.p,0),false,false);let result=raw25(r(false,add(args.p,0),4) as i32,r(false,add(add(args.p,0),4),4) as i32);let dst=p2 as u32;range(false,dst,8,4);zero(false,dst,8);c18(result as u32,dst,true,false);post25(result as i32);}
}
