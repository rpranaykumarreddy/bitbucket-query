console.log("I am the BQL Commander in charge of the BQL extension");

chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.create({url: 'help.html'});
});

var bitbucketQueryData = {
    active: null,
    workspaces: {},
    isLoaded: false
}

loadFromLocalStorage();

function loadFromLocalStorage() {
    chrome.storage.local.get(["workspaces", "active"], (result) => {
        if (result.workspaces === undefined) {
            saveToLocalStorage();
            console.log("No data found in local storage, so created a new one");
        } else {
            bitbucketQueryData = result;
            console.log("Data found & it is set to", bitbucketQueryData);
        }
        bitbucketQueryData.isLoaded = true;
    });
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log('req', request.message);
        if (!bitbucketQueryData.isLoaded) {
            console.log('Data not loaded yet');
            sendResponse({roger: false});
            return;
        }
        switch (request.message) {
            case 'found_this_commander':
                console.log(request, 'found_this_commander');
                processScrapedData(request);
                sendResponse({roger: true});
                break;
            default:
                console.log('default', request);
                sendResponse({roger: false});
        }
    }
);

function processScrapedData(data) {
    const type = data.type;
    let workspaceName = data.workspaceName?.toLowerCase().trim() || '';
    if (workspaceName === '' || workspaceName === undefined) {
        console.log("No workspace name found");
        return;
    }
    if (type === 'workspace') {
        processWorkspaceData(workspaceName);
    } else if (type === 'repositories') {
        let repositories = data.repositories.map(repo => repo.toLowerCase().trim()).filter(repo => repo.length > 0);
        processRepositoriesData(workspaceName, repositories);
    } else {
        let repositoryName = data.repositoryName?.toLowerCase().trim() || '';
        if (repositoryName === '' || repositoryName === undefined) {
            console.log("No repository name found");
            return;
        }
        switch (type) {
            case 'branches':
                const branches = data.branches || [];
                const mappedBranches = branches.map(branch => branch.trim()).filter(branch => branch.length > 0);
                processBranchesData(workspaceName, repositoryName, mappedBranches);
                break;
            case 'tags':
                const tags = data.tags || [];
                const mappedTags = tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
                processTagsData(workspaceName, repositoryName, mappedTags);
                break;
            case 'commits':
                const commitData = data.commits.map(commit => {
                    const {commitId, message} = commit;
                    const commitIdShort = commitId.trim().slice(0, 7);
                    return {
                        commitId: commitIdShort,
                        message: message
                    }
                }).filter(commit => commit.commitId.length > 0);
                const commitsBranches = data.branches || [];
                const mappedCommitsBranches = commitsBranches.map(branch => branch.trim()).filter(branch => branch.length > 0)
                const commitsTags = data.tags || [];
                const mappedCommitsTags = commitsTags.map(tag => tag.trim()).filter(tag => tag.length > 0);
                processCommitsData(workspaceName, repositoryName, mappedCommitsBranches, mappedCommitsTags, commitData);
                break;
            case 'pull-requests':
                const pullRequests = data.pullRequests.filter(pullRequest => pullRequest.pullNo.length > 0);
                processPullRequestsData(workspaceName, repositoryName, pullRequests);
                break;
            case 'pipelines':
                const pipelines = data.pipelines.filter(pipeline => pipeline.pipelineNo.length > 0);
                processPipelineData(workspaceName, repositoryName, pipelines);
                break;
            case 'environments':
                const environments = data.environments.map(environment => {
                    const {environmentId, environmentName} = environment;
                    return {
                        environmentId: environmentId?.trim(),
                        environmentName: environmentName?.toLowerCase().trim()
                    }
                })
                    .filter(environment => environment.environmentName.length > 0);
                processEnvironmentsData(workspaceName, repositoryName, environments);
                break;
            default:
                console.log("Unknown data type", type);
        }
    }
    saveToLocalStorage();
}

function setAsActiveWorkspace(workspaceName) {
    workspaceName = workspaceName?.toLowerCase();
    bitbucketQueryData.active = workspaceName;
}

function processWorkspaceData(workspaceName) {
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        bitbucketQueryData.workspaces[workspaceName] = {
            lastUsed: new Date().getTime(),
            repositories: {}
        }
        if (bitbucketQueryData.active === null)
            bitbucketQueryData.active = workspaceName;
        accessedWorkspace(workspaceName);
    }
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
            lastUsed: null
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
            lastUsed: null
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
            lastUsed: null
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
            message: message,
            lastUsed: null
        }
    }
    accessedWorkspace(workspaceName);
    accessedRepository(workspaceName, repositoryName);
    if (commits.length === 1) {
        accessedCommit(workspaceName, repositoryName, commits[0].commitId);
    }
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
            lastUsed: null
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
            lastUsed: null
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
            lastUsed: null
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
}

function accessedRepository(workspaceName, repositoryName) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].lastUsed = new Date().getTime();
}

function accessedBranch(workspaceName, repositoryName, branch) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].branches[branch].lastUsed = new Date().getTime();
}

function accessedTag(workspaceName, repositoryName, tag) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].tags[tag].lastUsed = new Date().getTime();
}

function accessedCommit(workspaceName, repositoryName, commitId) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].commits[commitId].lastUsed = new Date().getTime();
}

function accessedPullRequest(workspaceName, repositoryName, pullNo) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pullRequests[pullNo].lastUsed = new Date().getTime();
}

function accessedPipeline(workspaceName, repositoryName, pipelineNo) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].pipelines[pipelineNo].lastUsed = new Date().getTime();
}

function accessedEnvironment(workspaceName, repositoryName, environmentName) {
    bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].environments[environmentName].lastUsed = new Date().getTime();
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
    const suggestions =
        [
            {
                content: 'SET',
                description: 'SET "workspace-name" : Set the active workspace'
            },
            {
                content: 'LIST',
                description: 'LIST "workspace-name" : Open the list of repositories in the workspace'
            },
            {
                content: 'HELP',
                description: 'HELP : Get to new tab with all the commands'
            }
        ];
    suggestOpen([]).map(suggestion => suggestions.push(suggestion));
    suggest(suggestions);
}

function suggestionEngine(fragments, suggest) {
    const command = fragments[0]?.toUpperCase();
    let suggestions = [];
    switch (command) {
        case 'SET':
            suggestions = suggestSet(fragments);
            suggest(suggestions);
            break;
        case 'LIST':
            suggestions = suggestList(fragments);
            suggest(suggestions);
            break;
        case 'HELP':
            suggest([
                {
                    content: 'HELP',
                    description: 'HELP : Get to new tab with all the commands'
                }
            ])
            break;
        case '':
            console.log('Unknown command');
            defaultSuggest(suggest);
            break;
        default:
            suggestions = suggestOpen(fragments);
            suggest(suggestions);
    }
}

function suggestSet(fragments) {
    const workspaceName = fragments[1] || '';
    return Object.keys(bitbucketQueryData.workspaces)
        .filter(workspace => workspace.includes(workspaceName))
        .filter(workspace => workspace !== bitbucketQueryData.active)
        .sort((a, b) => {
            return sortOnLastUsed(bitbucketQueryData.workspaces, a, b);
        })
        .map(workspaceName => {
            return createSuggestion(`SET ${workspaceName}`, "As the active workspace");
        });
}

function suggestList(fragments) {
    const workspaceName = fragments[1] || '';
    const suggestions = [];
    if (workspaceName === '') {
        suggestions.push(
            createSuggestion("LIST", "List the repos in the ${bitbucketQueryData.active} workspace"));
    }
    Object.keys(bitbucketQueryData.workspaces)
        .filter(workspace => workspace.includes(workspaceName))
        .filter(workspace => workspace !== bitbucketQueryData.active || workspaceName !== '')
        .sort((a, b) => {
            return sortOnLastUsed(bitbucketQueryData.workspaces, a, b);
        })
        .map(workspaceName => {
            suggestions.push(
                createSuggestion(`LIST ${workspaceName}`, "List the repositories in the workspace"));
        });
    return suggestions;
}

function suggestOpen(fragments) {
    const repositoryName = fragments[0] || '';
    const workspaceName = bitbucketQueryData.active;
    const suggestions = [];
    if (bitbucketQueryData.workspaces[workspaceName] === undefined) {
        return [];
    }
    if (bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName] === undefined) {
        Object.keys(bitbucketQueryData.workspaces[workspaceName].repositories)
            .filter(repository => repository.includes(repositoryName))
            .sort((a, b) => {
                return sortOnLastUsed(bitbucketQueryData.workspaces[workspaceName].repositories, a, b);
            })
            .map(repositoryName => {
                suggestions.push(createSuggestion(`${repositoryName}`, "Open the repository"));
            });
        return suggestions;
    }
    const repositoryData = bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName];
    const openRepoBranchSuggestion = createSuggestion(`${repositoryName} BRANCH`, `Open the branches of the repository`);
    const openRepoTagSuggestion = createSuggestion(`${repositoryName} TAG`, `Open the tags of the repository`);
    const openRepoCommitSuggestion = createSuggestion(`${repositoryName} COMMIT`, `Open the commit history of the repository`);
    const openRepoPRSuggestion = createSuggestion(`${repositoryName} PR`, `Open the pull requests of the repository`);
    const openRepoPipelineSuggestion = createSuggestion(`${repositoryName} PIPELINE`, `Open the pipelines of the repository`);
    const openRepoDeploySuggestion = createSuggestion(`${repositoryName} DEPLOY`, `Open the deployments of the repository`);
    const openRepoCompareSuggestion = createSuggestion(`${repositoryName} COMPARE`, `Compare branches or tags`);
    const openRepoDiffSuggestion = createSuggestion(`${repositoryName} DIFF`, `Diff branches or tags`);

    const command = fragments[1]?.toUpperCase() || '';
    console.log(command)
    if (command === 'BRANCH') {
        const branch = fragments[2] || '';
        const subCommand = fragments[3]?.toUpperCase() || '';
        const commit = fragments[4]?.toLowerCase() || '';
        if (branch === '') {
            suggestions.push(openRepoBranchSuggestion);
        }
        Object.keys(repositoryData.branches)
            .filter(branchId => branchId.includes(branch))
            .sort((a, b) => {
                return sortOnLastUsed(repositoryData.branches, a, b);
            })
            .filter(branch => subCommand === "")
            .map(branch => {
                suggestions.push(createSuggestion(`${repositoryName} BRANCH ${branch}`, `Open the branch`));
            });
        if (commit === '' && branch !== '')
            suggestions.push(createSuggestion(`${repositoryName} BRANCH ${branch} COMMIT`, `Open the commit history of the branch`));
        Object.keys(repositoryData.commits)
            .filter(commit => repositoryData.commits[commit].branches.includes(branch))
            .map(commit => {
                suggestions.push(createSuggestion(`${repositoryName} BRANCH ${branch} COMMIT ${commit}`, escapeHtml(repositoryData.commits[commit].message)));
            });
    } else if (command === 'TAG') {
        const tag = fragments[2] || '';
        const subCommand = fragments[3]?.toUpperCase() || '';
        const commit = fragments[4]?.toLowerCase() || '';
        Object.keys(repositoryData.tags)
            .filter(tag => tag.includes(tag))
            .sort((a, b) => {
                return sortOnLastUsed(repositoryData.tags, a, b);
            })
            .filter(tag => subCommand === "")
            .map(tag => {
                suggestions.push(createSuggestion(`${repositoryName} TAG ${tag}`, `Open the tag`));
            });
        if (commit === '' && tag !== '')
            suggestions.push(createSuggestion(`${repositoryName} TAG ${tag} COMMIT`, `Open the commit history of the tag`));
        Object.keys(repositoryData.commits)
            .filter(commit => repositoryData.commits[commit].tags.includes(tag))
            .map(commit => {
                suggestions.push(createSuggestion(`${repositoryName} TAG ${tag} COMMIT ${commit}`, repositoryData.commits[commit].message));
            });
    } else if (command === 'COMMIT') {
        const commit = fragments[2]?.toLowerCase() || '';
        if (commit === '')
            suggestions.push(createSuggestion(`${repositoryName} COMMIT`, `Open the commit history of the repository`));
        Object.keys(repositoryData.commits)
            .filter(commitId => commitId.includes(commit))
            .sort((a, b) => {
                return sortOnLastUsed(repositoryData.commits, a, b);
            })
            .map(commitId => {
                suggestions.push(createSuggestion(`${repositoryName} COMMIT ${commitId}`, repositoryData.commits[commitId].message));
            });
    } else if (command === "PR") {
        const pr = fragments[2]?.toLowerCase() || '';
        if (pr === '')
            suggestions.push(createSuggestion(`${repositoryName} PR`, `Open the pull requests of the repository`));
        Object.keys(repositoryData.pullRequests)
            .filter(pullNo => pullNo.includes(pr))
            .sort((a, b) => {
                return sortOnLastUsed(repositoryData.pullRequests, a, b);
            })
            .map(pullNo => {
                suggestions.push(createSuggestion(`${repositoryName} PR ${pullNo}`, repositoryData.pullRequests[pullNo].pullName));
            });
    } else if (command === 'PIPELINE') {
        const pipeline = fragments[2]?.toLowerCase() || '';
        if (pipeline === '')
            suggestions.push(createSuggestion(`${repositoryName} PIPELINE`, `Open the pipelines of the repository`));
        Object.keys(repositoryData.pipelines)
            .filter(pipelineNo => pipelineNo.includes(pipeline))
            .sort((a, b) => {
                return sortOnLastUsed(repositoryData.pipelines, a, b);
            })
            .map(pipelineNo => {
                suggestions.push(createSuggestion(`${repositoryName} PIPELINE ${pipelineNo}`, repositoryData.pipelines[pipelineNo].pipelineName));
            });
    } else if (command === 'DEPLOY') {
        const deploy = fragments[2]?.toLowerCase() || '';
        if (deploy === '')
            suggestions.push(createSuggestion(`${repositoryName} DEPLOY`, `Open the deployments of the repository`));
        Object.keys(repositoryData.environments)
            .filter(environmentName => environmentName.includes(deploy))
            .filter(environmentName => repositoryData.environments[environmentName].environmentId !== undefined)
            .sort((a, b) => {
                return sortOnLastUsed(repositoryData.environments, a, b);
            });
    } else if (command === 'COMPARE') {
        const branchCompare = fragments[2] || '';
        const subCommandCompare = fragments[3]?.toUpperCase() || '';
        const branchTo = fragments[4] || '';
        const combinedCompareKeyValues = {}
        Object.keys(repositoryData.branches).map(branch => {
            combinedCompareKeyValues[branch] = repositoryData.branches[branch].lastUsed;
        })
        Object.keys(repositoryData.tags).map(tag => {
            combinedCompareKeyValues[tag] = repositoryData.tags[tag].lastUsed;
        });
        Object.keys(combinedCompareKeyValues)
            .filter(branch => branch.includes(branchCompare))
            .filter(branch => branch !== branchCompare)
            .filter(branch => subCommandCompare === "")
            .sort((a, b) => {
                return combinedCompareKeyValues[b] - combinedCompareKeyValues[a];
            })
            .map(branch => {
                suggestions.push(createSuggestion(`${repositoryName} COMPARE ${branch}`, `Compare branches or tags`));
            });
        Object.keys(combinedCompareKeyValues)
            .filter(branch => branch.includes(branchTo))
            .filter(branch => branch !== branchCompare)
            .filter(branch => branchCompare !== '')
            .sort((a, b) => {
                return combinedCompareKeyValues[b] - combinedCompareKeyValues[a];
            })
            .map(branch => {
                suggestions.push(createSuggestion(`${repositoryName} COMPARE ${branchCompare} TO ${branch}`, `Compare branches or tags`));
            });
    } else if (command === 'DIFF') {
        const branchDiff = fragments[2] || '';
        const subCommandDiff = fragments[3]?.toUpperCase() || '';
        const branchTo = fragments[4] || '';
        const combinedBranchesKeyValues = {}
        Object.keys(repositoryData.branches).map(branch => {
            combinedBranchesKeyValues[branch] = repositoryData.branches[branch].lastUsed;
        })
        Object.keys(repositoryData.tags).map(tag => {
            combinedBranchesKeyValues[tag] = repositoryData.tags[tag].lastUsed;
        });
        Object.keys(combinedBranchesKeyValues)
            .filter(branch => branch.includes(branchDiff))
            .filter(branch => subCommandDiff === "")
            .sort((a, b) => {
                return combinedBranchesKeyValues[b] - combinedBranchesKeyValues[a];
            })
            .map(branch => {
                suggestions.push(createSuggestion(`${repositoryName} DIFF ${branch}`, `Diff branches or tags`));
            });
        Object.keys(combinedBranchesKeyValues)
            .filter(branch => branch.includes(branchTo))
            .filter(branch => branch !== branchDiff)
            .filter(branch => branchDiff !== '')
            .sort((a, b) => {
                return combinedBranchesKeyValues[b] - combinedBranchesKeyValues[a];
            })
            .map(branch => {
                suggestions.push(createSuggestion(`${repositoryName} DIFF ${branchDiff} TO ${branch}`, `Diff branches or tags`));
            });
    } else {
        const tempSuggestions = [openRepoBranchSuggestion,
            openRepoTagSuggestion,
            openRepoCommitSuggestion,
            openRepoPRSuggestion,
            openRepoPipelineSuggestion,
            openRepoDeploySuggestion,
            openRepoCompareSuggestion,
            openRepoDiffSuggestion];

        tempSuggestions.filter(suggestion => {
            const content = suggestion.content.split(' ');
            const lastFragment = content.pop();
            return lastFragment.includes(command);
        }).map(suggestion => suggestions.push(suggestion));
    }
    return suggestions;
}

function createSuggestion(content, description) {
    return {
        content: content,
        description: escapeHtml(content + " : " + description)
    }
}


function sortOnLastUsed(data, a, b) {
    return data[b].lastUsed - data[a].lastUsed;
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
    const command = fragments[0]?.toUpperCase();
    try {
        switch (command) {
            case 'SET':
                processSet(fragments);
                break;
            case 'LIST':
                processList(fragments);
                break;
            case 'HELP':
                chrome.tabs.create({url: 'help.html'});
                break;
            default:
                processOpen(fragments);
        }
    } catch (e) {
        console.error('Error', e);
        notifyUser('Error', 'An error occurred while processing the command');
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
}

function processOpen(fragments) {
    const repositoryName = fragments[0]?.toLowerCase() || '';
    if (repositoryName === undefined || repositoryName === '') {
        notifyUser('No repository name', 'Please enter a repository name');
        return;
    }
    const workspaceName = bitbucketQueryData.active;
    let url = `https://bitbucket.org/${workspaceName}/${repositoryName}/`;

    const urlSuffix = getSuffixPathForOpen(fragments);
    if (urlSuffix === null) {
        return;
    }
    openTab(url + urlSuffix);
}


function getSuffixPathForOpen(fragments) {
    switch (fragments[1]?.toUpperCase()) {
        case 'BRANCH':
            const branch = fragments[2] || '';
            if (branch === '') {
                return 'branches';
            }
            if (fragments[3]?.toUpperCase() === 'COMMIT') {
                const commit = fragments[4]?.toLowerCase() || '';
                if (commit === '')
                    return `commits/branch/${branch}`;
                return `commits/${commit}`;
            }
            return `src/${branch}`;
        case 'TAG':
            const tag = fragments[2] || '';
            if (tag === '') {
                notifyUser('No tag name', 'Please enter a tag name');
                return `src`;
            }
            if (fragments[3]?.toUpperCase() === 'COMMIT') {
                const commit = fragments[4]?.toLowerCase() || '';
                if (commit === '')
                    return `commits/tag/${tag}`;
                return `commits/${commit}`;
            }
            return `src/${tag}`;
        case 'COMMIT':
            const commit = fragments[2]?.toLowerCase() || '';
            if (commit === '')
                return `commits`;
            return `commits/${commit}`;
        case 'PR':
            const pr = fragments[2]?.toLowerCase() || '';
            if (pr === '')
                return `pull-requests`;
            return `pull-requests/${pr}`;
        case 'PIPELINE':
            const pipeline = fragments[2]?.toLowerCase() || '';
            if (pipeline === '')
                return `pipelines`;
            return `pipelines/results/${pipeline}`;
        case 'DEPLOY':
            const deploy = fragments[2]?.toLowerCase() || '';
            if (deploy === '')
                return `deployments`;
            return `deployments/${deploy}`;
        case 'COMPARE':
            const branchFrom = fragments[2] || '';
            if (branchFrom === '' || fragments[3]?.toUpperCase() !== 'TO') {
                notifyUser('Invalid command', 'Please use "OPEN {{repo}} COMPARE {{branch}} TO {{compare}}"');
                return `branches/compare`;
            }
            const branchTo = fragments[4] || '';
            return `branches/compare/${branchFrom}%0D${branchTo}`;
        case 'DIFF':
            const branchDiff = fragments[2] || '';
            if (branchDiff === '') {
                notifyUser('No branch name', 'Please enter a branch name');
                return `branches`
            }
            if (fragments[3]?.toUpperCase() === 'TO') {
                const branchToDiff = fragments[4] || '';
                return `branch/${branchDiff}?dest=${branchToDiff}`;
            }
            return `branch/${branchDiff}`;
        default:
            return 'overview/';
    }
}

/* Tabs */
function openTab(url) {
    chrome.tabs.create({url: url, active: true, index: 50});
}

/* Notifications */
function notifyUser(title, message, requireInteraction = false) {
    console.log('📣', title, message);
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'logo128.png',
        title: title,
        message: message,
        priority: 0,
        requireInteraction: requireInteraction
    });
}

/* Local storage */
function saveToLocalStorage() {
    chrome.storage.local.set(bitbucketQueryData).then(() => {
        console.log(bitbucketQueryData, "Data is set to local storage");
    });
}

/*Text utility*/
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
        }
    });
}