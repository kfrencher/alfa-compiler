import { CompileMultipleRequest } from '../../../src/request-compile-multiple.js';

const rootPolicy = 
`namespace system_a {
  /*
   * Root policy set for system_a access
   * Uses deny-unless-permit for secure-by-default behavior
   */
  policyset root {
      target clause Attributes.subjectId == "system-a"

      apply denyUnlessPermit

      system_a.person
      system_a.group

  }
}`;

const personPolicy =
`/*
 * ALFA Policy: System A Person Dataset Access Control
 * 
 * This policy provides field-level access control for person dataset:
 * - Permits read access to the complete person dataset  
 * - Permits read access only to person.name and person.dob fields
 * - Denies access to all other person fields (secure by default)
 */

namespace system_a {

    import System.*
    import Attributes.*

    policyset person {
        // Constrain to person dataset
      target clause resourceId == "urn:klf:ds:person" 

      apply orderedDenyOverrides

      // Allow read access to the complete person dataset
      policy {
        target clause actionId == "read"

        apply denyUnlessPermit

        rule {
          permit
        }
      }

      // Grant field-level permit for listed fields only
      policyset fields {
        // Only use this policyset if there are field-level resources
        target clause stringStartsWith("urn:klf:ds:field", resourceId)

        apply firstApplicable

        // Deny access to all other fields by default
        // This constrains the requested fields to a whitelist
        policy denyUnauthorizedFields {

          apply firstApplicable

          rule {
              deny

              condition not(allOf(function[stringRegexpMatch],"^(urn:klf:ds:person|urn:klf:ds:field:person\\\\.(name|dob))$", resourceId))
          }
        }

        // Allow access to specific fields
        policy allowedFields {
          target clause 
            resourceId == "urn:klf:ds:field:person.name" or
            resourceId == "urn:klf:ds:field:person.dob"

          apply firstApplicable

          rule {
            permit
          }
        }
      }
    }
}`;

const groupPolcy =
`/*
 * ALFA Policy: System A group Dataset Access Control
 * 
 * This policy provides field-level access control for group dataset:
 * - Permits read access to the complete group dataset  
 * - Permits read access only to group.name and group.dob fields
 * - Denies access to all other group fields (secure by default)
 */

namespace system_a {

    import System.*
    import Attributes.*

    policyset group {
        // Constrain to group dataset
      target clause resourceId == "urn:klf:ds:group" 

      apply orderedDenyOverrides

      // Allow read access to the complete group dataset
      policy {
        target clause actionId == "read"

        apply denyUnlessPermit

        rule {
          permit
        }
      }

      // Grant field-level permit for listed fields only
      policyset fields {
        // Only use this policyset if there are field-level resources
        target clause stringStartsWith("urn:klf:ds:field", resourceId)

        apply firstApplicable

        // Deny access to all other fields by default
        // This constrains the requested fields to a whitelist
        policy denyUnauthorizedFields {

          apply firstApplicable

          rule {
              deny

              condition not(allOf(function[stringRegexpMatch],"^(urn:klf:ds:group|urn:klf:ds:field:group\\\\.(name|email))$", resourceId))
          }
        }

        // Allow access to specific fields
        policy allowedFields {
          target clause 
            resourceId == "urn:klf:ds:field:group.name" or
            resourceId == "urn:klf:ds:field:group.email"

          apply firstApplicable

          rule {
            permit
          }
        }
      }
    }
}`;

export const multiFileAlfaPolicy: CompileMultipleRequest = {
  files: [
    { fileName: 'system_a.root.alfa', content: rootPolicy },
    { fileName: 'system_a.person.alfa', content: personPolicy },
    { fileName: 'system_a.group.alfa', content: groupPolcy }
  ]
};