console.log("I am the solider");

chrome.runtime.sendMessage({'message': 'i_am_ready_commander'}, function (response) {
    console.log('response', response);
});

/*

Scrape data from the different bitbucket websites:
Different possible websites & data that can be found in it.
TODO: https://bitbucket.org/account/workspaces/ (Not addressed in below code & optional)
1. https://bitbucket.org/{{workspaceName}}/workspace/overview/ (Addressed in below code)
2. https://bitbucket.org/{{workspaceName}}/repositories/ (Addressed in below code)
3. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/src/{{branchName}} (Ignored in below code. as it can be commit id too)
4. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/commits/branch/{{branchName}} (Addressed in below code)
5. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/commits/tag/{{tagName}} (Addressed in below code)
6. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/commits/{{commitId}} (Addressed in below code)
7. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/branches/ (Addressed in below code)
8. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/branches/compare/vapt-2024%0Dmaster (Addressed in below code)
9. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/branch/{{branchName}} (Addressed in below code)
10. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/pull-requests/ (Addressed in below code)
11. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/pull-requests/{{pullNo}} (Addressed in below code)
12. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/pipelines (Addressed in below code)
13. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/pipelines/results/{{pipelineNo}} (Addressed in below code)
14. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/deployments (Addressed in below code)
15. https://bitbucket.org/{{workspaceName}}/{{repositoryName}}/deployments/environments/{{environmentId}} (Addressed in below code)

*/
scrapeData();
window.addEventListener('popstate', function (event) {
    console.log("URL changed (popstate):", window.location.href);
    setTimeout(() => {
        scrapeData();
    }, 5000);
});

window.addEventListener('hashchange', function () {
    console.log("URL hash changed:", window.location.href);
    setTimeout(() => {
        scrapeData();
    }, 5000);
});

window.addEventListener('load', function () {
    setTimeout(() => {
        scrapeData();
    }, 5000);
});

let lastUrl = window.location.href;
let skippedCount = 0;
let skipThreshold = 5;
setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        skippedCount = 0;
        skipThreshold = 5;
    } else if (skippedCount > skipThreshold) {
        scrapeData();
        skippedCount = 0;
        skipThreshold *= 2;
    } else {
        skippedCount++;
    }
}, 1000);

function scrapeData() {
    if (!window.location.hostname.includes("bitbucket.org")) {
        console.log("Not a bitbucket website");
        return;
    }
    const path = window.location.pathname;
    console.log("Scraping data from the bitbucket website");
    const fragments = path.split("/");
    console.log("Fragments", fragments);
    if (fragments.length < 2) {
        console.log("Not a valid bitbucket website");
        return;
    }
    const workspaceName = fragments[1];
    if (fragments[2] === "workspace") {
        if (fragments[3] === "overview") {
            console.log("Found the workspace overview page", workspaceName);
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'workspace',
                'workspaceName': workspaceName
            }, function (response) {
                console.log('response', response);
            });
        } else if (fragments[3] === "repositories") {
            console.log("Inside the repositories page", workspaceName);
            const repositories = scrapeDataFromRepositoriesPage();
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'repositories',
                'workspaceName': workspaceName,
                'repositories': repositories
            }, function (response) {
                console.log('response', response);
            });
        }
    } else if (fragments[3] === "src") {
        const repositoryName = fragments[2];
        const branchName = fragments[4];
        /*
        Removed this code as it is not required
        console.log("Inside the source code page", workspaceName, repositoryName, branchName);
        chrome.runtime.sendMessage({
            'message': 'found_this_commander',
            'type': 'branches',
            'workspaceName': workspaceName,
            'repositoryName': repositoryName,
            'branches': [branchName]
        }, function (response) {
            console.log('response', response);
        });
        */
    } else if (fragments[3] === "commits") {
        const repositoryName = fragments[2];
        if (fragments[4] === "branch") {
            const branchName = fragments[5];
            console.log("Inside the commits page", workspaceName, repositoryName, branchName);
            const commits = scrapeDataFromCommitsPage();
            console.log("Commits", commits);
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'commits',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'branches': [branchName],
                'commits': commits
            }, function (response) {
                console.log('response', response);
            });
        } else if (fragments[4] === "tag") {
            const tagName = fragments[5];
            console.log("Inside the commits page", workspaceName, repositoryName, tagName);
            const commits = scrapeDataFromCommitsPage();
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'commits',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'tags': [tagName],
                'commits': commits
            }, function (response) {
                console.log('response', response);
            });
        } else {
            const commitId = fragments[4].slice(0, 7);
            console.log("Inside the commits page", workspaceName, repositoryName, commitId);
            const {branches, tags,message} = scrapeDataFromCommitOverviewPage();
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'commits',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'branches': branches,
                'tags': tags,
                'commits': [{commitId,message}]
            }, function (response) {
                console.log('response', response);
            });
        }
    } else if (fragments[3] === "branches") {
        console.log("Inside the branches page", workspaceName);
        if (fragments[4] === "compare") {
            const repositoryName = fragments[2];
            const branches = fragments[5].split("%0D");
            console.log("Inside the branches compare page", workspaceName, repositoryName, branches);
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'branches',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'branches': branches
            }, function (response) {
                console.log('response', response);
            });
        } else {
            const repositoryName = fragments[2];
            const branches = scrapeDataFromBranchesPage();
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'branches',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'branches': branches
            }, function (response) {
                console.log('response', response);
            });
        }
    } else if (fragments[3] === "branch") {
        console.log("Inside the branch page", workspaceName);
        const repositoryName = fragments[2];
        const branchName = fragments.slice(4).join("/");
        console.log("Inside the branch page", workspaceName, repositoryName, branchName);
        chrome.runtime.sendMessage({
            'message': 'found_this_commander',
            'type': 'branches',
            'workspaceName': workspaceName,
            'repositoryName': repositoryName,
            'branches': [branchName]
        }, function (response) {
            console.log('response', response);
        });
    } else if (fragments[3] === "pull-requests") {
        console.log("Inside the pull requests page", workspaceName);
        const repositoryName = fragments[2];
        if(fragments[4] !=="" && !isNaN(fragments[4])) {
            const pullNo = fragments[4];
            console.log("Inside the pull requests page", workspaceName, repositoryName, pullNo);
            const pullName = scrapeDataFromPullOverviewPage();
            const pullRequests = [{pullNo, pullName}];
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'pull-requests',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'pullRequests': pullRequests
            }, function (response) {
                console.log('response', response);
            });
        } else {
            console.log("Inside the pull requests page", workspaceName, repositoryName);
            const pullRequests = scrapeDataFromPullRequestsPage();
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'pull-requests',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'pullRequests': pullRequests
            }, function (response) {
                console.log('response', response);
            });
        }
    } else if (fragments[3] === "pipelines") {
        const repositoryName = fragments[2];
        if(fragments[4] === "results") {
            const pipelineNo = fragments[5];
            console.log("Inside the pipelines results page", workspaceName);
            const pipelineName = scrapeDataFromPipelineResultsPage();
            const pipelines= [{pipelineNo, pipelineName}];
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'pipelines',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'pipelines': pipelines
            }, function (response) {
                console.log('response', response);
            });
        } else {
            console.log("Inside the pipelines page", workspaceName);
            const pipelines = scrapeDataFromPipelineOverviewPage();
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'pipelines',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'pipelines': pipelines
            }, function (response) {
                console.log('response', response);
            });
        }
    } else if (fragments[3] === "deployments"){
        const repositoryName = fragments[2];
        if(fragments[4] === "environments") {
            const environmentId = fragments[5];
            console.log("Inside the deployments environments page", workspaceName, repositoryName, environmentId);
            const environmentName = scrapeDataFromEnvironmentPreviewPage();
            const environments= [{environmentId, environmentName}];
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'environments',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'environments': environments
            }, function (response) {
                console.log('response', response);
            });
        } else {
            console.log("Inside the deployments page", workspaceName);
            const environments = scrapeDataFromDeploymentsPage();
            chrome.runtime.sendMessage({
                'message': 'found_this_commander',
                'type': 'environments',
                'workspaceName': workspaceName,
                'repositoryName': repositoryName,
                'environments': environments
            }, function (response) {
                console.log('response', response);
            });
        }
    }
}

function scrapeDataFromRepositoriesPage() {
    var repositories = [];
    var tables = document.getElementsByTagName("table");
    if (tables.length === 0) {
        console.log("No tables found");
        return repositories;
    }
    var rows = tables[0].getElementsByTagName("tbody")[0].getElementsByTagName("tr");
    for (var i = 0; i < rows.length; i++) {
        var repoName = rows[i].getElementsByTagName("td")[0].getElementsByTagName("a")[1].innerText;
        repositories.push(repoName);
    }
    return repositories;
}

function scrapeDataFromCommitsPage() {
    var commits = [];
    var tables = document.getElementsByTagName("table");
    if (tables.length === 0) {
        console.log("No tables found");
        return commits;
    }
    var rows = tables[0].getElementsByTagName("tbody")[0].getElementsByTagName("tr");
    for (var i = 0; i < rows.length; i++) {
        var commitId = rows[i].getElementsByTagName("td")[1].innerText;
        var message = rows[i].getElementsByTagName("td")[2].querySelectorAll('[title]')[0].innerText.trim();
        commits.push({commitId,message});
    }
    return commits;
}

function scrapeDataFromCommitOverviewPage() {
    var branches = [];
    var tags = [];
    var message = document.querySelectorAll('[data-testid="profileCardTrigger"]')[0]?.parentElement?.parentElement?.nextElementSibling?.innerText;
    const elements = document.getElementsByClassName("sidebar-expander-panel-heading");
    const branchElement = Array.from(elements).filter(a => a.innerText.includes("branch"));
    if (branchElement.length > 0 && branchElement[0]?.parentElement?.nextSibling !== null) {
        branchElement[0].parentElement.nextSibling.innerText.replaceAll("\n", "").replaceAll("Create tag", "").split(",").map(a => a.trim()).forEach(a => {
            if (a !== "") {
                branches.push(a);
            }
        });
    }
    const tagElement = Array.from(elements).filter(a => a.innerText.includes("tag"));
    if (tagElement.length > 0 && tagElement[0]?.parentElement?.nextSibling !== null) {
        tagElement[0].parentElement.nextSibling.innerText.replaceAll("\n", "").replaceAll("Create tag", "").split(",").map(a => a.trim()).forEach(a => {
            if (a !== "") {
                tags.push(a);
            }
        });
    }
    console.log("Branches", branches, "Tags", tags);
    return {branches, tags,message};
}

function scrapeDataFromBranchesPage() {
    var branches = [];
    var tables = document.getElementsByTagName("table");
    if (tables.length === 0) {
        console.log("No tables found");
        return branches;
    }
    var rows = tables[0].getElementsByTagName("tbody")[0].getElementsByTagName("tr");
    for (var i = 0; i < rows.length; i++) {
        var branchName = rows[i].getElementsByTagName("td")[0].getElementsByTagName("a")[0].innerText;
        branches.push(branchName);
    }
    console.log("Branches", branches);
    return branches;
}

function scrapeDataFromPullOverviewPage() {
    return document.getElementsByTagName("form")[0].innerText;
}

function scrapeDataFromPullRequestsPage() {
    var pullRequests = [];
    var tables = document.getElementsByTagName("table");
    if (tables.length === 0) {
        console.log("No tables found");
        return pullRequests;
    }
    var rows = tables[0]?.getElementsByTagName("tbody")[0]?.getElementsByTagName("tr");
    for (var i = 0; i < rows.length; i++) {
        var element= rows[i]?.getElementsByTagName("td")[0]?.getElementsByTagName('a')[0];
        var pullNo = element.href.split('/').pop();
        var pullName = element.innerText;
        pullRequests.push({pullNo, pullName});
    }
    return pullRequests;
}

function scrapeDataFromPipelineResultsPage() {
    return document.querySelectorAll('[data-testid="commit-message"]')[0]?.getElementsByTagName("a")[0]?.nextElementSibling.innerText;
}

function scrapeDataFromPipelineOverviewPage() {
    var pipelines = [];
    var tables = document.getElementsByTagName("table");
    if (tables.length === 0) {
        console.log("No tables found");
        return pipelines;
    }
    var rows = tables[0].getElementsByTagName("tbody")[0]?.getElementsByTagName("tr");
    for (var i = 0; i < rows.length; i++) {
        var element = rows[i]?.getElementsByTagName("td")[1]?.getElementsByTagName("a")[0];
        var pipelineNo = element.href.split('/').pop();
        var pipelineName = element.innerText;
        pipelines.push({pipelineNo, pipelineName});
    }
    return pipelines;
}

function scrapeDataFromDeploymentsPage() {
    var deployments =[]
    const elements = document.querySelectorAll('[data-testid="environment-history-launcher"]');
    for (var i = 0; i < elements.length; i++) {
        var environmentId = null;
        var environmentName = elements[i].getElementsByTagName('h4')[0].innerText.trim();
        deployments.push({environmentId, environmentName});
    }
    return deployments;
}

function scrapeDataFromEnvironmentPreviewPage() {
    const elements = document.querySelectorAll('[title]');
    const filteredElements = Array.from(elements).filter(element =>
        /.* environment/.test(element.title)
    );

    console.log(filteredElements);  // Output: Array of elements with matching titles

    return filteredElements[0].innerText.replaceAll(" environment", "").trim();
}