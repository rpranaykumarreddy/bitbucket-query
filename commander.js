console.log("I am the Commander in charge of the extension");

/*
Core functions (version: 1.0.0):
1. Scrape data from the different bitbucket websites (solider.js)
2. Process & store data in the local storage (commander.js)
3. Process query along with suggestions (solider.js)
4. Open a new tab with the processed data (commander.js)
*/

var bitbucketQueryData = {
    active: null,
    workspaces: {},
    isLoaded: false
}

loadFromLocalStorage();

function loadFromLocalStorage() {
    chrome.storage.local.get(["workspaces", "active"], (result) => {
        console.log("Checking local storage", result);
        if (result.workspaces === undefined) {
            console.log("No data found, setting up the data");
            saveToLocalStorage();
        } else {
            console.log("Data found in the local storage", result);
            bitbucketQueryData = result;
            console.log("Data is set to", bitbucketQueryData);
        }
        bitbucketQueryData.isLoaded = true;
    });
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log('req', request.message);
        if (!bitbucketQueryData.isLoaded) {
            console.log('Data not loaded yet');
            // TODO: Store the request in a queue
            sendResponse({roger: false});
            return;
        }
        switch (request.message) {
            case 'found_this_commander':
                console.log('found_this_commander');
                processScrapedData(request);
                sendResponse({roger: true});
                break;
            case 'requesting_to_open':
                console.log('req Open', request.url);
                chrome.tabs.create({url: request.url, active: false, index: 50});
                sendResponse({roger: true});
                break;
            default:
                console.log('default');
                sendResponse({roger: false});
        }
    }
);

function processScrapedData(data) {
    const type = data.type;
    switch (type) {
        case 'workspace':
            processWorkspaceData(data.workspaceName);
            break;
        case 'repositories':
            processRepositoriesData(data.workspaceName, data.repositories);
            break;
        case 'branches':
            processBranchesData(data.workspaceName, data.repositoryName, data.branches);
            break;
        case 'tags':
            processTagsData(data.workspaceName, data.repositoryName, data.tags);
            break;
        case 'commits':
            processCommitsData(data.workspaceName, data.repositoryName, data.branches, data.tags, data.commits);
            break;
        case 'pull-requests':
            processPullRequestsData(data.workspaceName, data.repositoryName, data.pullRequests);
            break;
        case 'pipelines':
            processPipelineData(data.workspaceName, data.repositoryName, data.pipelines);
            break;
        case 'environments':
            processEnvironmentsData(data.workspaceName, data.repositoryName, data.environments);
            break;
        default:
            console.log("Unknown data type", type);
    }
    saveToLocalStorage();
}

function setAsActiveWorkspace(workspaceName) {
    workspaceName = workspaceName?.toLowerCase();
    bitbucketQueryData.active = workspaceName;
}

function processWorkspaceData(workspaceName) {
    workspaceName = workspaceName?.toLowerCase();
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        bitbucketQueryData.workspaces[workspaceName] = {
            lastUsed: new Date().getTime(),
            count: 0,
            repositories: {}
        }
        if (bitbucketQueryData.active === null)
            bitbucketQueryData.active = workspaceName;
    }
    accessedWorkspace(workspaceName);
}

function processRepositoriesData(workspaceName, repositories) {
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        processWorkspaceData(workspaceName);
    }
    for (const repositoryName of repositories) {
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] !== undefined)
            continue;
        bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] = {
            branches: {},
            commits: {},
            tags: {},
            pipelines: {},
            pullRequests: {},
            environments: {},
            lastUsed: null,
            count: 0
        }
    }
    accessedWorkspace(workspaceName);
    if (repositories.length === 1) {
        for (const repositoryName of repositories) {
            accessedRepository(workspaceName, repositoryName);
        }
    }
}

function processBranchesData(workspaceName, repositoryName, branches) {
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        processWorkspaceData(workspaceName);
    }
    if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] === undefined) {
        processRepositoriesData(workspaceName, [repositoryName]);
    }
    for (const branch of branches) {
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].branches[branch] !== undefined)
            continue;
        bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].branches[branch] = {
            lastUsed: null,
            count: 0
        }
    }
    if (branches.length === 1) {
        for (const branch of branches) {
            accessedBranch(workspaceName, repositoryName, branch);
        }
    }
    accessedWorkspace(workspaceName);
    accessedRepository(workspaceName, repositoryName);
}

function processTagsData(workspaceName, repositoryName, tags) {
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        processWorkspaceData(workspaceName);
    }
    if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] === undefined) {
        processRepositoriesData(workspaceName, [repositoryName]);
    }
    for (const tag of tags) {
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].tags[tag] !== undefined)
            continue;
        bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].tags[tag] = {
            lastUsed: null,
            count: 0
        }
    }
    if (tags.length === 1) {
        for (const tag of tags) {
            accessedTag(workspaceName, repositoryName, tag);
        }
    }
    accessedWorkspace(workspaceName);
    accessedRepository(workspaceName, repositoryName);
}

function processCommitsData(workspaceName, repositoryName, branches, tags, commits) {
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        processWorkspaceData(workspaceName);
    }
    if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] === undefined) {
        processRepositoriesData(workspaceName, [repositoryName]);
    }
    if (branches === undefined || branches === null) {
        branches = [];
    }
    if (tags === undefined || tags === null) {
        tags = [];
    }
    for (const branch of branches) {
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].branches[branch] === undefined) {
            processBranchesData(workspaceName, repositoryName, [branch]);
        }
        accessedBranch(workspaceName, repositoryName, branch);
    }
    for (const tag of tags) {
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].tags[tag] === undefined) {
            processTagsData(workspaceName, repositoryName, [tag]);
        }
        accessedTag(workspaceName, repositoryName, tag);
    }
    for (const commit of commits) {
        const {commitId, message} = commit;
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].commits[commitId] !== undefined) {
            for (const branch of branches) {
                if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].commits[commitId].branches.indexOf(branch) === -1) {
                    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].commits[commitId].branches.push(branch);
                }
            }
            for (const tag of tags) {
                if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].commits[commitId].tags.indexOf(tag) === -1) {
                    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].commits[commitId].tags.push(tag);
                }
            }
            bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].commits[commitId].message = message;
            continue;
        }
        bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].commits[commitId] = {
            branches: branches,
            tags: tags,
            message: message
        }
    }
    accessedWorkspace(workspaceName);
    accessedRepository(workspaceName, repositoryName);
}

function processPullRequestsData(workspaceName, repositoryName, pullRequests) {
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        processWorkspaceData(workspaceName);
    }
    if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] === undefined) {
        processRepositoriesData(workspaceName, [repositoryName]);
    }
    for (const pullRequest of pullRequests) {
        const {pullNo, pullName} = pullRequest;
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pullRequests[pullNo] !== undefined) {
            bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pullRequests[pullNo].pullName = pullName;
            continue;
        }
        bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pullRequests[pullNo] = {
            pullName: pullName,
            lastUsed: null,
            count: 0
        }
    }
    if (pullRequests.length === 1) {
        for (const pullRequest of pullRequests) {
            accessedPullRequest(workspaceName, repositoryName, pullRequest.pullNo);
        }
    }
    accessedWorkspace(workspaceName);
    accessedRepository(workspaceName, repositoryName);
}

function processPipelineData(workspaceName, repositoryName, pipelines) {
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        processWorkspaceData(workspaceName);
    }
    if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] === undefined) {
        processRepositoriesData(workspaceName, [repositoryName]);
    }
    for (const pipeline of pipelines) {
        const {pipelineNo, pipelineName} = pipeline;
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pipelines[pipelineNo] !== undefined) {
            bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pipelines[pipelineNo].pipelineName = pipelineName;
            continue;
        }
        bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pipelines[pipelineNo] = {
            pipelineName: pipelineName,
            lastUsed: null,
            count: 0
        }
    }
    if (pipelines.length === 1) {
        for (const pipeline of pipelines) {
            accessedPipeline(workspaceName, repositoryName, pipeline.pipelineNo);
        }
    }
    accessedWorkspace(workspaceName);
    accessedRepository(workspaceName, repositoryName);
}

function processEnvironmentsData(workspaceName, repositoryName, environments) {
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        processWorkspaceData(workspaceName);
    }
    if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] === undefined) {
        processRepositoriesData(workspaceName, [repositoryName]);
    }
    for (const environment of environments) {
        const {environmentId, environmentName} = environment;
        if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].environments[environmentName] !== undefined) {
            if (environmentId !== undefined && environmentId !== null && environmentId?.trim() !== '') {
                bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].environments[environmentName].environmentId = environmentId;
            }
            continue;
        }
        bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].environments[environmentName] = {
            environmentId: environmentId,
            lastUsed: null,
            count: 0
        }
    }

    if (environments.length === 1) {
        for (const environment of environments) {
            accessedEnvironment(workspaceName, repositoryName, environment.environmentName);
        }
    }
    accessedWorkspace(workspaceName);
    accessedRepository(workspaceName, repositoryName);
}

/* General analytics utility */
function accessedWorkspace(workspaceName) {
    bitbucketQueryData.workspaces[workspaceName].lastUsed = new Date().getTime();
    bitbucketQueryData.workspaces[workspaceName].count++;
}

function accessedRepository(workspaceName, repositoryName) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].lastUsed = new Date().getTime();
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].count++;
}

function accessedBranch(workspaceName, repositoryName, branch) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].branches[branch].lastUsed = new Date().getTime();
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].branches[branch].count++;
}

function accessedTag(workspaceName, repositoryName, tag) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].tags[tag].lastUsed = new Date().getTime();
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].tags[tag].count++;
}

// No analytics for commits.

function accessedPullRequest(workspaceName, repositoryName, pullNo) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pullRequests[pullNo].lastUsed = new Date().getTime();
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pullRequests[pullNo].count++;
}

function accessedPipeline(workspaceName, repositoryName, pipelineNo) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pipelines[pipelineNo].lastUsed = new Date().getTime();
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pipelines[pipelineNo].count++;
}

function accessedEnvironment(workspaceName, repositoryName, environmentName) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].environments[environmentName].lastUsed = new Date().getTime();
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].environments[environmentName].count++;
}

/* Omnibox: Search processing */
chrome.omnibox.onInputChanged.addListener(function (text, suggest) {
    console.log('✏️ onInputChanged: ' + text);
    const fragments = text.trim().split(' ').map(fragment => fragment.trim()).filter(fragment => fragment.length > 0);
    console.log('fragments', fragments);
    if (fragments.length === 0) {
        defaultSuggest(suggest);
        return;
    }
    suggestionEngine(fragments, suggest);
});

function defaultSuggest(suggest) {
    suggest([
        {
            content: 'SET',
            description: 'SET "workspace-name" - Set the active workspace'
        },
        {
            content: 'LIST',
            description: 'LIST "workspace-name" - Open the list of repositories in the workspace'
        },
        {
            content: 'OPEN',
            description: 'OPEN "repository-name" - Open the repository'
        }
    ]);
}

function suggestionEngine(fragments, suggest) {
    const command = fragments[0].toUpperCase();
    let suggestions = [];
    switch (command) {
        case 'SET':
            suggestions = suggestSet(fragments, suggest);
            suggest(suggestions);
            break;
        case 'LIST':
            suggestions = suggestList(fragments, suggest);
            suggest(suggestions);
            break;
        case 'OPEN':
            suggestions = suggestOpen(fragments, suggest);
            suggest(suggestions);
            break;
        default:
            console.log('Unknown command');
            defaultSuggest(suggest);
    }
}

function suggestSet(fragments) {
    const workspaceName = fragments[1] || '';
    return Object.keys(bitbucketQueryData.workspaces)
        .filter(workspace => workspace.includes(workspaceName))
        .filter(workspace => workspace !== bitbucketQueryData.active)
        .sort((a, b) => {
            return bitbucketQueryData.workspaces[b].lastUsed - bitbucketQueryData.workspaces[a].lastUsed;
        })
        .map(workspaceName => {
            return createSuggestion(`SET ${workspaceName}`, `SET "${workspaceName}" - as the active workspace`);
        });
}

function suggestList(fragments) {
    const workspaceName = fragments[1] || '';
    const suggestions = [];
    if (workspaceName === '') {
        suggestions.push(
            createSuggestion(`LIST`, `LIST - List the repos in the ${bitbucketQueryData.active} workspace`));
    }
    Object.keys(bitbucketQueryData.workspaces)
        .filter(workspace => workspace.includes(workspaceName))
        .filter(workspace => workspace !== bitbucketQueryData.active || workspaceName !== '')
        .sort((a, b) => {
            return bitbucketQueryData.workspaces[b].lastUsed - bitbucketQueryData.workspaces[a].lastUsed;
        })
        .map(workspaceName => {
            suggestions.push(
                createSuggestion(`LIST ${workspaceName}`, `LIST "${workspaceName}" - List the repositories in the workspace`));
        });
    return suggestions;
}

function suggestOpen(fragments) {
    const repositoryName = fragments[1] || '';
    const workspaceName = bitbucketQueryData.active;
    const suggestions = [];
    if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] === undefined) {
        Object.keys(bitbucketQueryData.workspaces[workspaceName].repositories)
            .filter(repository => repository.includes(repositoryName))
            .sort((a, b) => {
                return bitbucketQueryData.workspaces[workspaceName].repositories[b].lastUsed - bitbucketQueryData.workspaces[workspaceName].repositories[a].lastUsed;
            })
            .map(repositoryName => {
                suggestions.push(createSuggestion(`OPEN ${repositoryName}`, `OPEN "${repositoryName}" - Open the repository`));
            });
        return suggestions;
    }
    const repositoryData = bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName];
    const openRepoBranchSuggestion = createSuggestion(`OPEN ${repositoryName} BRANCH`, `OPEN "${repositoryName}" BRANCH - Open the branches of the repository`);
    const openRepoTagSuggestion = createSuggestion(`OPEN ${repositoryName} TAG`, `OPEN "${repositoryName}" TAG - Open the tags of the repository`);
    const openRepoCommitSuggestion = createSuggestion(`OPEN ${repositoryName} COMMIT`, `OPEN "${repositoryName}" COMMIT - Open the commit history of the repository`);
    const openRepoPRSuggestion = createSuggestion(`OPEN ${repositoryName} PR`, `OPEN "${repositoryName}" PR - Open the pull requests of the repository`);
    const openRepoPipelineSuggestion = createSuggestion(`OPEN ${repositoryName} PIPELINE`, `OPEN "${repositoryName}" PIPELINE - Open the pipelines of the repository`);
    const openRepoDeploySuggestion = createSuggestion(`OPEN ${repositoryName} DEPLOY`, `OPEN "${repositoryName}" DEPLOY - Open the deployments of the repository`);
    const openRepoCompareSuggestion = createSuggestion(`OPEN ${repositoryName} COMPARE`, `OPEN "${repositoryName}" COMPARE - Compare branches or tags`);
    const openRepoDiffSuggestion = createSuggestion(`OPEN ${repositoryName} DIFF`, `OPEN "${repositoryName}" DIFF - Diff branches or tags`);

    const command = fragments[2]?.toUpperCase() || '';
    if (command === 'BRANCH') {
        const branch = fragments[3]?.toLowerCase() || '';
        if (branch === '') {
            suggestions.push(openRepoBranchSuggestion);
        }
        if (repositoryData.branches[branch] === undefined) {
            Object.keys(repositoryData.branches)
                .filter(branchId => branchId.includes(branch))
                .sort((a, b) => {
                    return repositoryData.branches[b].lastUsed - repositoryData.branches[a].lastUsed;
                })
                .map(branch => {
                    suggestions.push(createSuggestion(`OPEN ${repositoryName} BRANCH ${branch}`, `OPEN "${repositoryName}" BRANCH "${branch}" - Open the branch`));
                });
        } else {
            const subCommand = fragments[4]?.toUpperCase() || '';
            if (subCommand === 'COMMIT') {
                const commit = fragments[5]?.toLowerCase() || '';
                if (commit === '') {
                    suggestions.push(createSuggestion(`OPEN ${repositoryName} BRANCH ${branch} COMMIT`, `OPEN "${repositoryName}" BRANCH "${branch}" COMMIT - Open the commit history of the branch`));
                }
                Object.keys(repositoryData.commits)
                    .filter(commit => repositoryData.commits[commit].branches.includes(branch))
                    .map(commit => {
                        suggestions.push(createSuggestion(`OPEN ${repositoryName} BRANCH ${branch} COMMIT ${commit}`, `... COMMIT "${commit}" - [${repositoryData.commits[commit].message}]`));
                    });
            } else {
                suggestions.push(createSuggestion(`OPEN ${repositoryName} BRANCH ${branch}`, `OPEN "${repositoryName}" BRANCH "${branch}" - Open the branch`));
                suggestions.push(createSuggestion(`OPEN ${repositoryName} BRANCH ${branch} COMMIT`, `OPEN "${repositoryName}" BRANCH "${branch}" COMMIT - Open the commit history of the branch`));
            }
        }
    } else if (command === 'TAG') {

        const tag = fragments[3]?.toLowerCase() || '';
        if (repositoryData.tags[tag] === undefined) {
            Object.keys(repositoryData.tags)
                .filter(tag => tag.includes(tag))
                .sort((a, b) => {
                    return repositoryData.tags[b].lastUsed - repositoryData.tags[a].lastUsed;
                })
                .map(tag => {
                    suggestions.push(createSuggestion(`OPEN ${repositoryName} TAG ${tag}`, `OPEN "${repositoryName}" TAG "${tag}" - Open the tag`));
                });
        } else {
            const subCommand = fragments[4]?.toUpperCase() || '';
            if (subCommand === 'COMMIT') {
                const commit = fragments[5]?.toLowerCase() || '';
                if (commit === '') {
                    suggestions.push(createSuggestion(`OPEN ${repositoryName} TAG ${tag} COMMIT`, `OPEN "${repositoryName}" TAG "${tag}" COMMIT - Open the commit history of the tag`));
                }
                Object.keys(repositoryData.commits)
                    .filter(commit => repositoryData.commits[commit].tags.includes(tag))
                    .map(commit => {
                        suggestions.push(createSuggestion(`OPEN ${repositoryName} TAG ${tag} COMMIT ${commit}`, `... COMMIT "${commit}" - [${repositoryData.commits[commit].message}]`));
                    });
            } else {
                suggestions.push(createSuggestion(`OPEN ${repositoryName} TAG ${tag}`, `OPEN "${repositoryName}" TAG "${tag}" - Open the tag`));
                suggestions.push(createSuggestion(`OPEN ${repositoryName} TAG ${tag} COMMIT`, `OPEN "${repositoryName}" TAG "${tag}" COMMIT - Open the commit history of the tag`));
            }
        }
    } else if (command === 'COMMIT') {

        const commit = fragments[3]?.toLowerCase() || '';
        if (commit === '') {
            suggestions.push(createSuggestion(`OPEN ${repositoryName} COMMIT`, `OPEN "${repositoryName}" COMMIT - Open the commit history of the repository`));
        }
        Object.keys(repositoryData.commits)
            .filter(commitId => commitId.includes(commit))
            .sort((a, b) => {
                return a.indexOf(commit) - b.indexOf(commit);
            })
            .map(commitId => {
                suggestions.push(createSuggestion(`OPEN ${repositoryName} COMMIT ${commitId}`, `... COMMIT "${commitId}" - [${repositoryData.commits[commitId].message}]`));
            });
    } else if (command === "PR") {
        const pr = fragments[3]?.toLowerCase() || '';
        if (pr === '') {
            suggestions.push(createSuggestion(`OPEN ${repositoryName} PR`, `OPEN "${repositoryName}" PR - Open the pull requests of the repository`));
        }
        Object.keys(repositoryData.pullRequests)
            .filter(pullNo => pullNo.includes(pr))
            .sort((a, b) => {
                return repositoryData.pullRequests[b].lastUsed - repositoryData.pullRequests[a].lastUsed;
            })
            .map(pullNo => {
                suggestions.push(createSuggestion(`OPEN ${repositoryName} PR ${pullNo}`, `... PR "${pullNo}" - [${repositoryData.pullRequests[pullNo].pullName}]`));
            });
    } else if (command === 'PIPELINE') {
        const pipeline = fragments[3]?.toLowerCase() || '';
        if (pipeline === '') {
            suggestions.push(createSuggestion(`OPEN ${repositoryName} PIPELINE`, `OPEN "${repositoryName}" PIPELINE - Open the pipelines of the repository`));
        }
        Object.keys(repositoryData.pipelines)
            .filter(pipelineNo => pipelineNo.includes(pipeline))
            .sort((a, b) => {
                return repositoryData.pipelines[b].lastUsed - repositoryData.pipelines[a].lastUsed;
            })
            .map(pipelineNo => {
                suggestions.push(createSuggestion(`OPEN ${repositoryName} PIPELINE ${pipelineNo}`, `... PIPELINE "${pipelineNo}" - [${repositoryData.pipelines[pipelineNo].pipelineName}]`));
            });
    } else if (command === 'DEPLOY') {
        const deploy = fragments[3]?.toLowerCase() || '';
        if (deploy === '') {
            suggestions.push(createSuggestion(`OPEN ${repositoryName} DEPLOY`, `OPEN "${repositoryName}" DEPLOY - Open the deployments of the repository`));
        }
        Object.keys(repositoryData.environments)
            .filter(environmentName => environmentName.includes(deploy))
            .filter(environmentName => repositoryData.environments[environmentName].environmentId !== undefined)
            .sort((a, b) => {
                return repositoryData.environments[b].lastUsed - repositoryData.environments[a].lastUsed;
            });
    } else if (command === 'COMPARE') {
        const branchCompare = fragments[3]?.toLowerCase() || '';
        if (repositoryData.branches[branchCompare] === undefined) {
            Object.keys(repositoryData.branches)
                .filter(branch => branch.includes(branchCompare))
                .sort((a, b) => {
                    return repositoryData.branches[b].lastUsed - repositoryData.branches[a].lastUsed;
                })
                .map(branch => {
                    suggestions.push(createSuggestion(`OPEN ${repositoryName} COMPARE ${branch}`, `OPEN "${repositoryName}" COMPARE "${branch}" - Compare branches or tags`));
                });
        } else {
            const subCommandCompare = fragments[4]?.toUpperCase() || '';
            if (subCommandCompare === 'TO') {
                const branchTo = fragments[5]?.toLowerCase() || '';
                if (repositoryData.branches[branchTo] !== undefined) {
                    suggestions.push(createSuggestion(`OPEN ${repositoryName} COMPARE ${branchCompare} TO ${branchTo}`, `OPEN "${repositoryName}" COMPARE "${branchCompare}" TO "${branchTo}" - Compare branches or tags`));
                } else {
                    Object.keys(repositoryData.branches)
                        .filter(branch => branch.includes(branchTo))
                        .filter(branch => branch !== branchCompare)
                        .sort((a, b) => {
                            return repositoryData.branches[b].lastUsed - repositoryData.branches[a].lastUsed;
                        })
                        .map(branch => {
                            suggestions.push(createSuggestion(`OPEN ${repositoryName} COMPARE ${branchCompare} TO ${branch}`, `OPEN "${repositoryName}" COMPARE "${branchCompare}" TO "${branch}" - Compare branches or tags`));
                        });
                }
            } else {
                suggestions.push(createSuggestion(`OPEN ${repositoryName} COMPARE ${branchCompare}`, `OPEN "${repositoryName}" COMPARE "${branchCompare}" - Compare branches or tags`));
                Object.keys(repositoryData.branches)
                    .filter(branch => branch !== branchCompare)
                    .sort((a, b) => {
                        return repositoryData.branches[b].lastUsed - repositoryData.branches[a].lastUsed;
                    })
                    .map(branch => {
                        suggestions.push(createSuggestion(`OPEN ${repositoryName} COMPARE ${branchCompare} TO ${branch}`, `OPEN "${repositoryName}" COMPARE "${branchCompare}" TO "${branch}" - Compare branches or tags`));
                    });
            }
        }
    } else if (command === 'DIFF') {

        const branchDiff = fragments[3]?.toLowerCase() || '';
        if (repositoryData.branches[branchDiff] === undefined) {
            Object.keys(repositoryData.branches)
                .filter(branch => branch.includes(branchDiff))
                .sort((a, b) => {
                    return repositoryData.branches[b].lastUsed - repositoryData.branches[a].lastUsed;
                })
                .map(branch => {
                    suggestions.push(createSuggestion(`OPEN ${repositoryName} DIFF ${branch}`, `OPEN "${repositoryName}" DIFF "${branch}" - Diff branches or tags`));
                });
        } else {
            const subCommandDiff = fragments[4]?.toUpperCase() || '';
            if (subCommandDiff === 'TO') {
                const branchTo = fragments[5]?.toLowerCase() || '';
                if (repositoryData.branches[branchTo] !== undefined) {
                    suggestions.push(createSuggestion(`OPEN ${repositoryName} DIFF ${branchDiff} TO ${branchTo}`, `OPEN "${repositoryName}" DIFF "${branchDiff}" TO "${branchTo}" - Diff branches or tags`));
                } else {
                    Object.keys(repositoryData.branches)
                        .filter(branch => branch.includes(branchTo))
                        .filter(branch => branch !== branchDiff)
                        .sort((a, b) => {
                            return repositoryData.branches[b].lastUsed - repositoryData.branches[a].lastUsed;
                        })
                        .map(branch => {
                            suggestions.push(createSuggestion(`OPEN ${repositoryName} DIFF ${branchDiff} TO ${branch}`, `OPEN "${repositoryName}" DIFF "${branchDiff}" TO "${branch}" - Diff branches or tags`));
                        });
                }
            } else {
                suggestions.push(createSuggestion(`OPEN ${repositoryName} DIFF ${branchDiff}`, `OPEN "${repositoryName}" DIFF "${branchDiff}" - Diff branches or tags`));
                Object.keys(repositoryData.branches)
                    .filter(branch => branch !== branchDiff)
                    .sort((a, b) => {
                        return repositoryData.branches[b].lastUsed - repositoryData.branches[a].lastUsed;
                    })
                    .map(branch => {
                        suggestions.push(createSuggestion(`OPEN ${repositoryName} DIFF ${branchDiff} TO ${branch}`, `OPEN "${repositoryName}" DIFF "${branchDiff}" TO "${branch}" - Diff branches or tags`));
                    });
            }
        }
    } else {
        suggestions.push(openRepoBranchSuggestion);
        suggestions.push(openRepoTagSuggestion);
        suggestions.push(openRepoCommitSuggestion);
        suggestions.push(openRepoPRSuggestion);
        suggestions.push(openRepoPipelineSuggestion);
        suggestions.push(openRepoDeploySuggestion);
        suggestions.push(openRepoCompareSuggestion);
        suggestions.push(openRepoDiffSuggestion);
    }
    return suggestions;
}

function createSuggestion(content, description) {
    return {
        content: content,
        description: description
    }
}

/* Omnibox: Input processing */
chrome.omnibox.onInputEntered.addListener(function (text, disposition) {
    console.log(`✔️ onInputEntered: text -> ${text} | disposition -> ${disposition}`);
    const fragments = text.trim().split(' ').map(fragment => fragment.trim()).filter(fragment => fragment.length > 0);
    console.log('fragments', fragments);
    processInput(fragments);
});

function processInput(fragments) {
    if (fragments.length === 0) {
        notifyUser('No command', 'Please enter a command');
        return;
    }
    const command = fragments[0].toUpperCase();
    switch (command) {
        case 'SET':
            processSet(fragments);
            break;
        case 'LIST':
            processList(fragments);
            break;
        case 'OPEN':
            processOpen(fragments);
            break;
        default:
            console.log('Unknown command');
    }
}

function processSet(fragments) {
    const workspaceName = fragments[1]?.toLowerCase();
    if (workspaceName === undefined) {
        notifyUser('No workspace name', 'Please enter a workspace name');
        return;
    }
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        processWorkspaceData(workspaceName);
        setAsActiveWorkspace(workspaceName);
        saveToLocalStorage();
        notifyUser('Created a active workspace', `Created and set workspace "${workspaceName}" as active`);
        return;
    }
    setAsActiveWorkspace(workspaceName);
    saveToLocalStorage();
    notifyUser('Set active workspace', `Set workspace "${workspaceName}" as active`);
}

function processList(fragments) {
    const workspaceName = fragments[1]?.toLowerCase() || bitbucketQueryData.active;
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        notifyUser('No workspace found', `No workspace found with the name "${workspaceName}"`);
        return;
    }
    const url = `https://bitbucket.org/${workspaceName}/workspace/repositories/`;
    openTab(url);
    notifyUser('Opening workspace', `Opening workspace "${workspaceName}"`);
}

function processOpen(fragments) {
    const repositoryName = fragments[1]?.toLowerCase() || '';
    if (repositoryName === undefined || repositoryName === '') {
        notifyUser('No repository name', 'Please enter a repository name');
        return;
    }
    const workspaceName = bitbucketQueryData.active;
    let url = `https://bitbucket.org/${workspaceName}/${repositoryName}/overview/`;
    let title = `Opening repository "${repositoryName}"`;
    let message = `Opening repository "${repositoryName}" in workspace "${workspaceName}"`;
    switch (fragments[2].toUpperCase()) {
        case 'BRANCH':
            const branch = fragments[3]?.toLowerCase() || '';
            if (branch === '') {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/branches`;
                title = `Opening branches of "${repositoryName}"`;
                message = `Opening branches of "${repositoryName}" in workspace "${workspaceName}"`;
            } else {
                if (fragments[4]?.toUpperCase() === 'COMMIT') {
                    const commit = fragments[5]?.toLowerCase() || '';
                    if (commit === '') {
                        url = `https://bitbucket.org/${workspaceName}/${repositoryName}/commits/branch/${branch}`;
                        title = `Opening commit history of branch "${branch}" of "${repositoryName}"`;
                        message = `Opening commit history of branch "${branch}" of "${repositoryName}" in workspace "${workspaceName}"`;
                    } else {
                        url = `https://bitbucket.org/${workspaceName}/${repositoryName}/commits/${commit}`;
                        title = `Opening commit details of commit "${commit}" of "${repositoryName}"`;
                        message = `Opening commit details of commit "${commit}" of "${repositoryName}" in workspace "${workspaceName}"`;
                    }
                } else {
                    url = `https://bitbucket.org/${workspaceName}/${repositoryName}/src/${branch}`;
                    title = `Opening branch "${branch}" of "${repositoryName}"`;
                    message = `Opening branch "${branch}" of "${repositoryName}" in workspace "${workspaceName}"`;
                }
            }
            break;
        case 'TAG':
            const tag = fragments[3]?.toLowerCase() || '';
            if (tag === '') {
                notifyUser('No tag name', 'Please enter a tag name');
                return;
            } else {
                switch (fragments[4]?.toUpperCase()) {
                    case 'COMMIT':
                        url = `https://bitbucket.org/${workspaceName}/${repositoryName}/commits/tag/${tag}`;
                        title = `Opening commit history of tag "${tag}" of "${repositoryName}"`;
                        message = `Opening commit history of tag "${tag}" of "${repositoryName}" in workspace "${workspaceName}"`;
                        break;
                    default:
                        url = `https://bitbucket.org/${workspaceName}/${repositoryName}/src/${tag}`;
                        title = `Opening tag "${tag}" of "${repositoryName}"`;
                        message = `Opening tag "${tag}" of "${repositoryName}" in workspace "${workspaceName}"`;
                }
            }
            break;
        case 'COMMIT':
            const commit = fragments[3]?.toLowerCase() || '';
            if (commit === '') {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/commits`;
                title = `Opening commit history of "${repositoryName}"`;
                message = `Opening commit history of "${repositoryName}" in workspace "${workspaceName}"`;
            } else {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/commits/${commit}`;
                title = `Opening commit details of commit "${commit}" of "${repositoryName}"`;
                message = `Opening commit details of commit "${commit}" of "${repositoryName}" in workspace "${workspaceName}"`;
            }
            break;
        case 'PR':
            const pr = fragments[3]?.toLowerCase() || '';
            if (pr === '') {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/pull-requests`;
                title = `Opening pull requests of "${repositoryName}"`;
                message = `Opening pull requests of "${repositoryName}" in workspace "${workspaceName}"`;
            } else {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/pull-requests/${pr}`;
                title = `Opening pull request "${pr}" of "${repositoryName}"`;
                message = `Opening pull request "${pr}" of "${repositoryName}" in workspace "${workspaceName}"`;
            }
            break;
        case 'PIPELINE':
            const pipeline = fragments[3]?.toLowerCase() || '';
            if (pipeline === '') {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/pipelines`;
                title = `Opening pipelines of "${repositoryName}"`;
                message = `Opening pipelines of "${repositoryName}" in workspace "${workspaceName}"`;
            } else {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/pipelines/results/${pipeline}`;
                title = `Opening pipeline "${pipeline}" of "${repositoryName}"`;
                message = `Opening pipeline "${pipeline}" of "${repositoryName}" in workspace "${workspaceName}"`;
            }
            break;
        case 'DEPLOY':
            const deploy = fragments[3]?.toLowerCase() || '';
            if (deploy === '') {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/deployments`;
                title = `Opening deployments of "${repositoryName}"`;
                message = `Opening deployments of "${repositoryName}" in workspace "${workspaceName}"`;
            } else {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/deployments/${deploy}`;
                title = `Opening deployment "${deploy}" of "${repositoryName}"`;
                message = `Opening deployment "${deploy}" of "${repositoryName}" in workspace "${workspaceName}"`;
            }
            break;
        case 'COMPARE':
            const branchFrom = fragments[3]?.toLowerCase() || '';
            if (branchFrom === '' || fragments[4]?.toUpperCase() !== 'TO') {
                notifyUser('Invalid command', 'Please use "OPEN {{repo}} COMPARE {{branch}} TO {{compare}}"');
                return;
            }
            const branchTo = fragments[5]?.toLowerCase() || '';
            url = `https://bitbucket.org/${workspaceName}/${repositoryName}/branches/compare/${branchFrom}..${branchTo}`;
            break;
        case 'DIFF':
            const branchDiff = fragments[3]?.toLowerCase() || '';
            if (branchDiff === '') {
                notifyUser('No branch name', 'Please enter a branch name');
                return;
            }
            if (fragments[4]?.toUpperCase() === 'TO') {
                const branchToDiff = fragments[5]?.toLowerCase() || '';
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/branch/${branchDiff}?dest=${branchToDiff}`;
                title = `Diffing branch "${branchDiff}" with "${branchToDiff}" of "${repositoryName}"`;
                message = `Diffing branch "${branchDiff}" with "${branchToDiff}" of "${repositoryName}" in workspace "${workspaceName}"`;
            } else {
                url = `https://bitbucket.org/${workspaceName}/${repositoryName}/branch/${branchDiff}`;
                title = `Diffing branch "${branchDiff}" with default branch of "${repositoryName}"`;
                message = `Diffing branch "${branchDiff}" with default branch of "${repositoryName}" in workspace "${workspaceName}"`;
            }
            break;
        default:
            notifyUser('Invalid command', 'Please enter a valid command');
            return;
    }
    openTab(url);
    notifyUser(title, message);
}


/* Tabs */
function openTab(url) {
    chrome.tabs.create({url: url, active: true, index: 50});
}

/* Notifications */
function notifyUser(title, message) {
    console.log('📣', title, message);
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'logo128.png',
        title: title,
        message: message,
        priority: 2
    });
}

/* Local storage */
function saveToLocalStorage() {
    chrome.storage.local.set(bitbucketQueryData).then(() => {
        console.log("Data is set to", bitbucketQueryData);
    });
}