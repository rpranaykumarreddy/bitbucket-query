console.log("I am the Commander in charge of the extension");

/*
Core functions (version: 1.0.0):
1. Scrape data from the different bitbucket websites (solider.js)
2. Process & store data in the local storage (commander.js)
TODO: 3. Process query along with suggestions (solider.js)
TODO: 4. Open a new tab with the processed data (commander.js)
*/

var bitbucketQueryData = {
    active: null,
    workspaces: {},
    isLoaded: false
}

loadFromLocalStorage();

//Need a function to load the data from the local storage & wait for it to load
function loadFromLocalStorage() {
    chrome.storage.local.get(["workspaces", "active"], (result) => {
        console.log("Checking local storage", result);
        if (result.workspaces === undefined) {
            chrome.storage.local.set(bitbucketQueryData, () => {
                console.log("No data found, setting up the data");
                console.log("Data is set to", bitbucketQueryData);
            });
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
        case 'pipelines':
            processPipelineData(data.workspaceName, data.repositoryName, data.pipelines);
            break;
        case 'environments':
            processEnvironmentsData(data.workspaceName, data.repositoryName, data.environments);
            break;
        default:
            console.log("Unknown data type", type);
    }
    chrome.storage.local.set(bitbucketQueryData).then(() => {
        console.log("Data is set to", bitbucketQueryData);
    });
}

function processWorkspaceData(workspaceName) {
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
            bitbucketQueryData.workspaces[workspaceName].repositories[repositoryName].environments[environmentName].environmentId = environmentId;
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