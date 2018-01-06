const spawn = require('cross-spawn');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const compilationStartedRegex = /Starting incremental compilation/;
const compilationCompleteRegex = / Compilation complete\. Watching for file changes\./;
const typescriptSuccessRegex = /Compilation complete/;
const typescriptErrorRegex = /\(\d+,\d+\): error TS\d+:/;

let firstTimeTag = false;
let timer = getTimer();

function watch(projDir, compiler, callback) {
    log(`使用编译器${compiler},开始执行tsc watch.`);
    let hadErrors = false;
    let firstTime = true;
    let firstSuccessProcess = null;
    let firstSuccessProcessExited = null;
    let successProcess = null;
    let successProcessExited = null;

    const bin = require.resolve(`${compiler}/bin/tsc`);
    const tscProcess = spawn(bin, ['--watch'], { cwd: projDir });

    tscProcess.stdout.on('data', buffer => {
        const lines = buffer.toString()
            .split('\n')
            .filter(a => a.length > 0)
            .filter(a => a !== '\r')

        print(lines);

        const newCompilation = lines.some(line => compilationStartedRegex.test(line));
        if (newCompilation) {
            hadErrors = false;
        }

        const error = lines.some(line => typescriptErrorRegex.test(line));
        if (error) {
            hadErrors = true;
        }

        const compilationComplete = lines.some(line => compilationCompleteRegex.test(line));
        if (compilationComplete) {
            if (hadErrors) {
                log('Had errors, not spawning');
            } else {
                if (!firstTimeTag) {
                    firstTimeTag = true;
                    log(`第一次编译耗时${getTimer() - timer}ms`)
                    timer = getTimer()
                }
                emitManifest(projDir);
                callback && callback();
            }
        }
    });
}


function emitManifest(projDir) {
    log('开始输出Manifest.使用typescript-plus');
    const ts = require("typescript-plus")
    var manifestPath = path.join(projDir, 'manifest.json');
    var configFileName = path.join(projDir, 'tsconfig.json');
    var jsonResult = ts.parseConfigFileTextToJson(configFileName, ts.sys.readFile(configFileName));
    const compilerOptions = jsonResult.config.compilerOptions
    var optionResult = ts.parseJsonConfigFileContent(jsonResult.config, ts.sys, projDir);
    let program = ts.createProgram(optionResult.fileNames, compilerOptions);

    let sortResult = ts.reorderSourceFiles(program);

    sortResult.sortedFileNames = sortResult.sortedFileNames
        .filter(item => item.indexOf('.d.ts') === -1)
        .map(item => item.replace('Client/src', 'bin-debug').replace('.ts', '.js'))

    let manifestContent = fs.readFileSync(manifestPath)
    manifestContent = JSON.parse(manifestContent);
    manifestContent.game = sortResult.sortedFileNames;
    fs.writeFileSync(manifestPath, JSON.stringify(manifestContent))
    log('输出Manifest完毕.');
}

function color(line) {
    if (typescriptErrorRegex.test(line)) {
        return chalk.red(line);
    }

    if (typescriptSuccessRegex.test(line)) {
        return chalk.green(line);
    }

    return chalk.white(line);
}

function print(lines) {
    return lines.forEach(line => console.log(color(line)));
}

function run(projDir, compiler, callback) {
    watch(projDir, compiler, callback);
}

function log(info) {
    console.log(`${getTime()} ${info}`);
}

function getTime() {
    return (new Date()).toLocaleTimeString();
}

function getTimer() {
    return new Date().getTime();
}

exports.run = run;