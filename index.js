#!/usr/bin/env node

/**
 * @file 小程序组件分析工具 swan-components-analyze
 */

const fs = require('fs');
const pth = require('path');
const glob = require('glob');
const lineByLine = require('n-readlines');

const SWAN_ROOT = process.cwd();

try {
    require(`${SWAN_ROOT}/project.swan.json`);
}
catch (error) {
    console.error('不是有效的百度小程序目录!')
    process.exit(-1);
}

/**
 * 读取文件行数
 * @param {string} path 
 * @returns {number}
 */
function countLinesNum(path) {
    if (fs.existsSync(path)) {
        let lineNumber = 0;
        const liner = new lineByLine(path);
        while (line = liner.next()) {
            lineNumber++;
        }
        return lineNumber;        
    }
    else {
        return null;
    }
}

const jsonList = glob.sync(`${SWAN_ROOT}/**/*.json`, {
    ignore: [
        `${SWAN_ROOT}/node_modules/**/*.json`,
        `${SWAN_ROOT}/*.json`,
        `${SWAN_ROOT}/.swan/*.json`,
        `${SWAN_ROOT}/.vscode/*.json`,
        `${SWAN_ROOT}/.idea/*.json`,
    ]
});

const allJsonMap = {};
const reportJson = {};
let components = [];

jsonList.forEach(parentRealPath => {
    const info = allJsonMap[parentRealPath] = require(parentRealPath);
    // init
    reportJson[parentRealPath] = {
        quotedNum: 0,
        parents: [],
        component: !!info.component,
    }
});

jsonList.forEach(parentRealPath => {
    const info = allJsonMap[parentRealPath] = require(parentRealPath);
    if (info.usingComponents) {
        const deps = info.usingComponents || [];
        Object.keys(deps).forEach(k => {
            const v = deps[k];
            let coKey = '';
            // 绝对路径（项目根目录）
            if (v.startsWith('/')) {
                coKey = pth.join(SWAN_ROOT, v) + '.json';
            }
            // 相对路径
            else if (v.startsWith('.')) {
                // console.log(v, parentRealPath);
                coKey = pth.resolve(pth.dirname(parentRealPath), v) + '.json';
            }
            // npm包 或者 dynamicLib
            else {
                coKey = v;
            }
            if (reportJson[coKey]) {
                reportJson[coKey].quotedNum = reportJson[coKey].quotedNum + 1;
                reportJson[coKey].parents.push(parentRealPath);
            }
        });
    }
});

Object.keys(reportJson).forEach(key => {
    components.push({
        key,
        ...reportJson[key],
    });
});


components = components.filter(i => i.component);
components = components.sort((i, j) => i.quotedNum - j.quotedNum);
components.forEach(i => {
    delete i.component;
});

// 读取js、css、swan文件行数
components.forEach(i => {
    if (i.key.startsWith('/')) {
        const jsPath = i.key.replace('.json', '.js');
        const cssPath = i.key.replace('.json', '.css');
        const swanPath = i.key.replace('.json', '.swan');
        const jsLines = countLinesNum(jsPath);
        const cssLines = countLinesNum(cssPath);
        const swanLines = countLinesNum(swanPath);

        i.size = {
            lines: jsLines + cssLines + swanLines,
            jsLines,
            cssLines,
            swanLines,
        }
    }
});

const reportDir = pth.join(SWAN_ROOT, './swan-components-analyze');

if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir);
}
fs.writeFileSync(
    pth.join(reportDir, 'report.json'),
    JSON.stringify({
        components,
    }, null, 4),
);

console.log(`组件分析报告已生成到文件 ${reportDir}/report.json`);