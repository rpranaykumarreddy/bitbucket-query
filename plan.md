# Bitbucket Query

Chrome extension for Bitbucket with features that remember projects, branches, commits, and deployments while enabling intuitive query-based navigation

Sample:

1. OPEN repoName BRANCH development.
2. OPEN repoName BRANCH master COMPARE development.

## Features
### **Quick query based navigation:**

Quickly navigate to repositories, branches, commits, tags, pull requests, pipelines, deployments, and compare branches.

### **Mark tabs as group:** (version 2.0)

Mark tabs as group & name them for quick opening.

### **MULTIPLE QUERY SUPPORT & TAG** (version 2.0)

It needs support of opening models by custom implementation. Tag actions for feature for quick open like espanso.

## Low Level Queries

1. SET:  
   This helps user to configure the default workspace for the extension.  
   It can take value directly or if value is cached, it can be selected from the list.  
   Ex: https://bitbucket.org/rpkr-nt/workspace/overview/. Here, rpkr-nt is the workspace.  
   User can set the workspace by SET rpkr-nt by or name would be Capitalized as Rpkr Nt after caching.  
   
   regex: `SET ?1`  
   possible sub-queries: NONE  

2. IN:  
   This helps user to navigate to the workspace without changing the default workspace.  
   It can take value directly or if value is cached, it can be selected from the list.  
   
   regex: `IN ?1`  
   possible sub-queries:  
      1. All possible queries that can be done in the workspace.  
         regex: `IN ?1 <QUERY>`

3. LIST:
   This helps user to list the repositories in the workspace.  
   It can take value of the workspace or default workspace will be taken.  
   Will take user to https://bitbucket.org/{{workspace}}/workspace/overview/  

   regex: `LIST` or `LIST ?1`  

4. OPEN:
   This helps user to open the repository in the workspace.  
   It can take value of repo name or if value is cached, it can be selected from the list.   
   Will take user to https://bitbucket.org/{{inherited_workspace}}/{{repo}}/overview/  

   regex: `OPEN ?1`
   possible sub-queries:
   - BRANCH {{branch}}
     To open source code of the branch.
     regex: `OPEN ?1 BRANCH ?2`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/src/{{branch}}
   - TAG {{tag}}
     To open source code of the tag.
     regex: `OPEN ?1 TAG ?2`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/src/{{tag}}
   - COMMIT
     To open commit history of default branch of the repository.
     regex: `OPEN ?1 COMMIT`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/commits
   - BRANCH {{branch}} COMMIT
     To open commit history of the branch.
     regex: `OPEN ?1 BRANCH ?2 COMMIT`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/commits/branch/{{branch}}
   - TAG {{tag}} COMMIT
     To open commit history of the tag.
     regex: `OPEN ?1 TAG ?2 COMMIT`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/commits/tag/{{tag}}
   - BRANCH
     To open branches of the repository.
     regex: `OPEN ?1 BRANCH`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/branches
   - PR
     To open pull requests of the repository.
     regex: `OPEN ?1 PR`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/pull-requests
   - PIPELINE
     to open pipelines of the repository.
     regex: `OPEN ?1 PIPELINE`
        https://bitbucket.org/{{inherited_workspace}}/{{repo}}/pipelines
   - DEPLOY
     to open deployments of the repository.
     regex: `OPEN ?1 DEPLOY`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/deployments
   - COMMIT {{commit}}
     To open commit details of the commit.
     regex: `OPEN ?1 COMMIT ?2`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/commits/{{commit}}
   - BRANCH {{branch}} COMMIT {{commit}}
     To open commit details of the commit in the branch.
     regex: `OPEN ?1 BRANCH ?2 COMMIT ?3`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/commits/{{commit}}
   - COMPARE {{branch}} TO {{compare}}
     To compare two branches or tags.
     regex: `OPEN ?1 COMPARE ?2 TO ?3`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/branches/compare/{{branch}}..{{compare}}
   - DIFF {{branch}}  
     Diff a branch with default branch.
      regex: `OPEN ?1 DIFF ?2`
      https://bitbucket.org/{{inherited_workspace}}/{{repo}}/branch/{{branch}}
   - DIFF {{branch}} TO {{compare}}  
     Diff a branch with another branch.  
     regex: `OPEN ?1 DIFF ?2 TO ?3`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/branch/{{branch}}?dest={{compare}}
   - PR {{pr}}  
     Open a pull request.  
     regex: `OPEN ?1 PR ?2`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/pull-requests/{{pr}}
   - PIPELINE {{pipeline}}  
     Open a pipeline.  
     regex: `OPEN ?1 PIPELINE ?2`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/pipelines/results/{{pipeline}}
   - DEPLOY {{deploy}}
     Open a deployment.
     Need to be id instead of name.
     regex: `OPEN ?1 DEPLOY ?2`
     https://bitbucket.org/{{inherited_workspace}}/{{repo}}/deployments/{{deploy_id}}

### Scrape:
We need to scrape the data from the page and store it in the extension storage for quick access.
Common details:
1. Name
2. ID (slug, if needed like deployment env, pull request id, etc.)
3. last used (millis)
4. count

Data structure:
Workspaces (Common fields)
  - Repos (Common fields)
    - Branches (Common fields)
    - Commits (Branches)
    - Tags (Common fields, Branches)
    - Pipelines (Common fields)
    - Pull Requests (Common fields)
    - Environments (Common fields)




Question:
Hi,
in EncryptionContext.java of common-util
you have added this try catch block

just curious, why was it added? was it failing for some scenarios?

My Reply refined:
Hi Akash,
Yes, it was failing to read unencrypted map or object type [mostly values before we decided to encrypt a field] for a new encrypted field
Even encrypted value in db will be object type.
Earlier, the algorithm expects any object type as encrypted value in db & starts checking for few fields like hashValue etc.
In case of unencrypted map or object type, it was failing to get such fields & throwing null pointer exception.
So, to support backward compatibility for map & object type, this try catch block was added.
Thanks for asking