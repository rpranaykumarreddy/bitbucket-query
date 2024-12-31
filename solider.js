console.debug("I am the solider");

scrapeData();
window.addEventListener('popstate', function () {
    setTimeout(() => {
        scrapeData();
    }, 5000);
});

window.addEventListener('hashchange', function () {
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
        return;
    }
    const path = window.location.pathname;
    const fragments = path.split("/");
    if (fragments.length < 2) {
        return;
    }
    const workspaceName = fragments[1];
    const typeMap = {
        "overview": "workspace",
        "repositories": "repositories",
        "commits": "commits",
        "branches": "branches",
        "branch": "branch",
        "pull-requests": "pull-requests",
        "pipelines": "pipelines",
        "deployments": "environments",
    };

    const section = fragments[3];
    const type = typeMap[section] || "";

    if (!type) return;

    const scrapeResult = scrapeDataSwitch(type, fragments);
    chrome.runtime.sendMessage(
        {
            message: "found_this_commander",
            type,
            workspaceName,
            repositoryName: fragments[2] !== "workspace" ? fragments[2] : "",
            ...scrapeResult,
        },
        function (response) {
            console.debug(response);
        }
    );
}

function scrapeDataSwitch(type, fragments) {
    switch (type) {
        case "repositories":
            return { repositories: scrapeDataFromRepositoriesPage() };
        case "commits":
            if (fragments[4] === "branch") {
                return { branches: [fragments[5]], commits: scrapeDataFromCommitsPage() };
            }
            if (fragments[4] === "tag") {
                return { tags: [fragments[5]], commits: scrapeDataFromCommitsPage() };
            }
            const commitId = fragments[4].slice(0, 7);
            const commitOutput = scrapeDataFromCommitOverviewPage();
            return {
                branches: commitOutput.branches,
                tags: commitOutput.tags,
                commits: [{ commitId, message: commitOutput.message }],
            };
        case "branch":
            return {branches: [fragments.slice(4).join("/")], type: "branches"};
        case "branches":
            return fragments[4] === "compare"
                ? { branches: fragments[5].split("%0D") }
                : { branches: scrapeDataFromBranchesPage() };
        case "pull-requests":
            if (fragments[4] && !isNaN(fragments[4])) {
                const pullNo = fragments[4];
                const pullName = scrapeDataFromPullOverviewPage();
                return { pullRequests: [{ pullNo, pullName }] };
            }
            return { pullRequests: scrapeDataFromPullRequestsPage() };
        case "pipelines":
            if (fragments[4] === "results") {
                const pipelineNo = fragments[5];
                const pipelineName = scrapeDataFromPipelineResultsPage();
                return { pipelines: [{ pipelineNo, pipelineName }] };
            }
            return { pipelines: scrapeDataFromPipelineOverviewPage() };
        case "environments":
            if (fragments[4] === "environments") {
                const environmentId = fragments[5];
                const environmentName = scrapeDataFromEnvironmentPreviewPage();
                return { environments: [{ environmentId, environmentName }] };
            }
            return { environments: scrapeDataFromDeploymentsPage() };
        default:
            return {};
    }
}

/* Functions to scrape data from the bitbucket website */
function scrapeDataFromRepositoriesPage() {
    var repositories = [];
    var tables = document.getElementsByTagName("table");
    if (tables.length === 0) {
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
        return commits;
    }
    var rows = tables[0].getElementsByTagName("tbody")[0].getElementsByTagName("tr");
    for (var i = 0; i < rows.length; i++) {
        var commitId = rows[i].getElementsByTagName("td")[1].innerText;
        var message = rows[i].getElementsByTagName("td")[2].querySelectorAll('[title]')[0].innerText.trim();
        commits.push({commitId, message});
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
    return {branches, tags, message};
}

function scrapeDataFromBranchesPage() {
    var branches = [];
    var tables = document.getElementsByTagName("table");
    if (tables.length === 0) {
        return branches;
    }
    var rows = tables[0].getElementsByTagName("tbody")[0].getElementsByTagName("tr");
    for (var i = 0; i < rows.length; i++) {
        var branchName = rows[i].getElementsByTagName("td")[0].getElementsByTagName("a")[0].innerText;
        branches.push(branchName);
    }
    return branches;
}

function scrapeDataFromPullOverviewPage() {
    return document.getElementsByTagName("form")[0].innerText;
}

function scrapeDataFromPullRequestsPage() {
    var pullRequests = [];
    var tables = document.getElementsByTagName("table");
    if (tables.length === 0) {
        return pullRequests;
    }
    var rows = tables[0]?.getElementsByTagName("tbody")[0]?.getElementsByTagName("tr");
    for (var i = 0; i < rows.length; i++) {
        var element = rows[i]?.getElementsByTagName("td")[0]?.getElementsByTagName('a')[0];
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
    var deployments = []
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
    return filteredElements[0].innerText.replaceAll(" environment", "").trim();
}