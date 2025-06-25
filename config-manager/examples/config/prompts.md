---
name: code-review
category: development
description: Template for code review requests
---
Please review the following {{language}} code in {{fileName}}.

The purpose of this code is: {{purpose}}

Key areas to focus on:
- Code quality and best practices
- Performance considerations
- Security implications
- Test coverage

{{additionalContext}}

---
name: bug-report
category: support
description: Template for bug reports
---
## Bug Report

**Environment:** {{environment}}
**Version:** {{version}}

**Description:**
{{description}}

**Steps to Reproduce:**
{{steps}}

**Expected Behavior:**
{{expected}}

**Actual Behavior:**
{{actual}}

**Additional Information:**
{{additionalInfo}}

---
name: feature-request
category: product
description: Template for feature requests
---
## Feature Request

**Feature Name:** {{featureName}}
**Priority:** {{priority}}

**Description:**
{{description}}

**User Story:**
As a {{userType}}, I want to {{action}} so that {{benefit}}.

**Acceptance Criteria:**
{{criteria}}

**Technical Considerations:**
{{technicalNotes}}

---
name: deployment-checklist
category: operations
description: Template for deployment checklists
---
# Deployment Checklist for {{applicationName}}

**Version:** {{version}}
**Environment:** {{environment}}
**Date:** {{date}}

## Pre-deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Database migrations prepared
- [ ] Backup created

## Deployment Steps
{{deploymentSteps}}

## Post-deployment
- [ ] Smoke tests passed
- [ ] Monitoring alerts configured
- [ ] Performance metrics baseline
- [ ] Rollback plan tested

## Notes
{{additionalNotes}}