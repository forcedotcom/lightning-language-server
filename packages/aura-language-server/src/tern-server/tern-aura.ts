import * as infer from 'tern/lib/infer';
import * as tern from 'tern/lib/tern';
import * as walk from 'acorn/dist/walk';
import * as fs from 'fs';
import * as path from 'path';
import { getComponentForJS, getLibFile, getLibraryForJS, getCmpImports, getLibImports, getLibIncludes } from './tern-indexer';

const WG_IMPORT_DEFAULT_FALLBACK = 80;
const WG_DEFAULT_EXPORT = 95;
let server = {};

const shouldFilter = false;

/* this is necessary to inform the parameter types of the controller when
    the helper method is deleted */
const ForAllProps_Purgeable = infer.constraint({
    construct: function(c) {
        this.c = c;
    },
    addType: function(type) {
        if (!(type instanceof infer.Obj)) {
            return;
        }
        type.forAllProps(this.c);
    },
    purge: function(test) {
        if (this.sources) {
            for (var i = 0; i < this.sources.length; i++) {
                this.sources[i].purge(test);
            }
        }
    },
    addSource: function(source) {
        if (!this.sources) {
            this.sources = [];
        }
        this.sources.push(source);
    },
});

async function readFile(filename) {
    return fs.readFileSync(filename, 'utf-8');
}

function getFilename(filename) {
    if (server.options.projectDir.endsWith('/')) {
        return server.options.projectDir + filename;
    }
    return server.options.projectDir + '/' + filename;
}

function parent(path) {
    var splits = path.split('/');
    if (splits.size == 1) {
        return '';
    }
    return splits[splits.length - 3];
}

function dirName(path) {
    var lastSlash = path.lastIndexOf('/');
    if (lastSlash == -1) {
        return '';
    }
    return path.slice(0, lastSlash + 1);
}

function baseName(path) {
    var lastSlash = path.lastIndexOf('/');
    if (lastSlash == -1) {
        return path;
    } else {
        return path.slice(lastSlash + 1);
    }
}

function trimExt(path) {
    var lastDot = path.lastIndexOf('.');
    if (lastDot == -1) {
        return path;
    } else {
        return path.slice(0, lastDot);
    }
}

function initScope(scope) {
    var module = new infer.Obj();
    module.propagate(scope.defProp('module'));
    var exports = new infer.Obj(true);
    module.origin = exports.origin = scope.origin;
    module.originNode = exports.originNode = scope.originNode;
    exports.propagate(scope.defProp('exports'));
    var moduleExports = (scope.exports = module.defProp('exports'));
    exports.propagate(moduleExports, WG_DEFAULT_EXPORT);
}
async function getLibraryIncludes(file, library) {
    var libFile = await getLibFile(file, library);
    var inc = await getLibIncludes(getFilename(libFile));
    var includes = [];
    var bn = dirName(libFile);
    inc.forEach(function(name) {
        var fname = bn + name + '.js';
        if (!isBlacklisted(fname)) {
            includes.push(fname);
        }
    });
    return includes;
}
async function newObj() {
    return new Promise((resolve, reject) => {
        infer.withContext(server.cx, function() {
            resolve(new infer.Obj(true));
        });
    });
}
async function processIfLibrary(file, modules) {
    let lib = await getLibraryForJS(file.name);
    let libs = lib ? [lib] : [];

    if (libs.length > 0) {
        _debug('Process libs of: ' + file.name);
        var bn = trimExt(baseName(file.name));
        var ln = trimExt(baseName(libs[0]));
        var libName = getFilename(libs[0]);
        var imps = await getLibImports(libName, bn);

        // use alternate module for libs
        var ns = parent(dirName(file.name));
        var l = modules.resolveModule('mod:' + ns + ':' + ln, file.name);
        var outObj;
        //console.log("__ the basename "+baseName(libs[0]) );
        if (!l.getType()) {
            //console.log("Created main entry for library");
            outObj = await newObj();
            outObj.origin = 'Aura';
            outObj.name = baseName(libs[0]);
            l.addType(outObj);
        } else {
            //console.log("Found main entry for library: "+l.getType() + " "+l.getType().name + " " + l.getType().origin);
            outObj = l.getType();
        }
        if (imps) {
            _debug('Process imported libs of: ' + file.name);
            // get fn decl
            var fn = file.ast.body[0];
            var state = fn.scope;
            // bind included imports to library function....
            var imports = imps.split(',');

            var libfilesResolved = [];
            var imfs = [];
            var importedModules = [];
            for (var i = 0; i < imports.length; i++) {
                // resolve....
                var importedModule = imports[i].trim();
                if (!importedModule) {
                    continue;
                }
                if (importedModule.indexOf(':') > -1) {
                    var splits = importedModule.split(':');
                    var qn = splits[0] + ':' + splits[1];
                    var libfile = await getLibFile(file.name, qn);
                    if (!libfile) continue;

                    lib = modules.resolveModule('mod:' + qn);
                    if (!lib.getType()) {
                        var zz = await newObj();
                        zz.origin = libfile;
                        zz.name = baseName(libfile);
                        lib.addType(zz);
                    }
                    libfilesResolved.push(modules.resolveModule('mod:' + qn));
                    importedModule = splits[2];
                    imfs.push(dirName(libfile) + importedModule + '.js');
                } else {
                    imfs.push(dirName(file.name) + importedModule + '.js');
                }
                importedModules.push(importedModule);
            }
            // re-establsh context after awaits
            infer.withContext(server.cx, function() {
                for (var i = 0; i < libfilesResolved.length; i++) {
                    let imf = imfs[i];
                    let importedModule = importedModules[i];
                    let lib = libfilesResolved[i];

                    var bno = trimExt(baseName(imf));
                    var lno = trimExt(baseName(imf));
                    var pm = state.fnType.args[i];
                    if (!pm || pm.getType(false)) continue;
                    if (lib.getType().hasProp(importedModule)) {
                        try {
                            pm.addType(
                                lib
                                    .getType()
                                    .getProp(importedModule)
                                    .getType(),
                            );
                        } catch (zzz) {}
                    } else {
                        var pname = importedModule;
                        // so, in effect this isn't really used, since (at least tern.ide)
                        // calls content assist frequently that by the time this called back,
                        // the file will be reindex, and the other lib file would have already
                        /// been loaded.
                        lib.getType().on(
                            'addProp',
                            function(pmType, prop, val) {
                                if (pname == prop) {
                                    pmType.addType(val);
                                }
                            }.bind(this, pm),
                        );
                    }
                }
            });
        }
        // re-establsh context after awaits
        infer.withContext(server.cx, function() {
            _debug('Process exported libs of: ' + file.name);
            walk.simple(
                file.ast,
                {
                    ReturnStatement: function(node, state) {
                        try {
                            var parent = infer.parentNode(node, file.ast);
                            var grand = infer.parentNode(parent, file.ast);
                            var great = infer.parentNode(grand, file.ast);
                            if (great && great['type'] === 'Program') {
                                if (node.argument) {
                                    if (node.argument['type'] === 'Identifier') {
                                        var t = state.getProp(node.argument.name);
                                        if (t) {
                                            var exported = t.getObjType();
                                            outObj.defProp(bn, node.argument).addType(exported);
                                        }
                                    } else if (node.argument['type'] === 'ObjectExpression') {
                                        outObj.defProp(bn, node.argument).addType(node.argument.objType);
                                    } else if (node.argument['type'] === 'FunctionExpression') {
                                        outObj.defProp(bn, node.argument).addType(state.fnType.getType());
                                    } else if (node.argument['type'] === 'CallExpression') {
                                        outObj.defProp(bn, node.argument).addType(state.getType());
                                    }
                                }
                            }
                        } catch (ignore) {
                            console.error(ignore);
                        }
                    },
                },
                infer.searchVisitor,
            );
        });
    }
}
async function processIfComponent(file, modules) {
    //        console.log("file " + file.name);
    //        console.log("cmp " + jsToCmp[file.name]);

    let cmp = await getComponentForJS(file.name);
    let cmps = cmp ? [cmp] : [];

    if (cmps.length > 0) {
        _debug('Discover libs of: ' + cmps[0]);
        let ins = await getCmpImports(getFilename(cmps[0]));
        let libs = [];
        for (let i = 0; i < ins.length; i++) {
            let an_import = ins[i];
            let library = an_import.library;
            let property = an_import.property;
            //console.log("Library: "+library);
            //console.log("property: "+property);
            //console.log(libsi[library]);
            let libfile = await getLibFile(file.name, library);
            libs.push(libfile);
        }
        for (let i = 0; i < libs.length; i++) {
            let library = ins[i].library;
            let libfile = libs[i];
            if (!libfile) continue;
            let lib = modules.resolveModule('mod:' + library, libfile);
            //console.log("Ensure lib added...")
            //console.log("Resolved: "+lib);
            if (!lib.getType()) {
                // console.log("no type")
                let zz = await newObj();
                zz.origin = libfile;
                zz.name = baseName(libfile);
                if (!lib.getType()) {
                    // recheck, after awaits
                    lib.addType(zz);
                }
                let inc = await getLibraryIncludes(file.name, library);
                for (let j = 0; j < inc.length; j++) {
                    if (!server.findFile(inc[j])) {
                        server.addFile(inc[j]);
                        // console.log("Added lib dep: "+inc[i]);
                    } else {
                        // console.log("File found");
                    }
                }
            }
        }

        // reestablish-context after awaits
        infer.withContext(server.cx, function() {
            for (let m = 0; m < libs.length; m++) {
                let library = ins[m].library;
                let libfile = libs[m];
                if (!libfile) continue;
                let property = ins[m].property;
                let lib = modules.resolveModule('mod:' + library, libfile);
                try {
                    walk.simple(
                        file.ast,
                        {
                            FunctionExpression: function(node, state) {
                                //console.log("Bound to this...");
                                var ss = node.scope;
                                var con = ss && ss.fnType && ss.fnType.self.getType();
                                if (con) {
                                    lib.getType().propagate(con.defProp(property));
                                }
                            },
                        },
                        infer.searchVisitor,
                    );
                } catch (ignore) {
                    console.error(ignore);
                }
            }
        });
    }
}

function _debug(log) {
    //console.log(log);
}
async function connectModule(file, out) {
    if (isBlacklisted(file.name)) {
        return;
    }

    server.startAsyncAction();
    var modules = infer.cx().parent.mod.modules;
    var cx = infer.cx();
    _debug('Starting... ' + file.name);
    await processIfLibrary(file, modules);
    await processIfComponent(file, modules);
    if (/Helper.js$/.test(file.name)) {
        // need to reestablish server context after awaits
        infer.withContext(server.cx, function() {
            _debug('Process helper exports ' + file.name);
            var outObj;
            if (!out.getType()) {
                var type = baseName(file.name).replace(/.js$/, '');
                outObj = new infer.Obj(true);
                outObj.origin = file.name;
                outObj.originNode = file.ast;
                outObj.name = type;
                out.addType(outObj);
            } else {
                outObj = out.getType();
            }
            try {
                walk.simple(
                    file.ast,
                    {
                        ObjectExpression: function(node, state) {
                            var parent = infer.parentNode(node, file.ast);
                            var grand = infer.parentNode(parent, file.ast);
                            if (grand.type == 'Program') {
                                // add some jsdoc
                                if (node.objType) {
                                    node.objType.doc =
                                        'A helper resource contains functions that can be reused by your JavaScript code in the component bundle. ';
                                }
                                //  node.objType.forAllProps( function(prop, val, local) {
                                //    val.propagate(outObj.defProp(prop));
                                //    });
                                // -- would have worked, but didnt'
                                // delete all types, and re-add...
                                var target = outObj.defProp(baseName(file.name).replace(/.js$/, ''));
                                var types = target.types;
                                while (types.length) types.pop();
                                //note: propogate calls addType on the target
                                // todo: this could be made more efficient with a custom propogation strategy
                                // similar to ForAllProps_Purgeable
                                if (node.objType) {
                                    try {
                                        node.objType.propagate(target);
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }
                                //outObj.defProp(baseName(file.name).replace(/.js$/, ''))
                                throw 'stop';
                            }
                        },
                    },
                    infer.searchVisitor,
                );
            } catch (stop) {
                if (stop !== 'stop') {
                    console.error(stop);
                    throw stop;
                }
            }
        });
        // We should also make sure that the controller is all up to date too...
        var controller = getController(file.name);
        try {
            var text = await readFile(controller);
            var sfile = server.findFile(controller);
            if (!sfile || sfile.text !== text) {
                server.addFile(controller, text);
            }
        } catch (ignore) {}
        var renderer = getRenderer(file.name);
        try {
            var text = await readFile(renderer);
            var sfile = server.findFile(renderer);
            if (!sfile || sfile.text !== text) {
                server.addFile(renderer, text);
            }
        } catch (ignore) {}
    }
    // reestablish scope after awaits
    infer.withContext(server.cx, function() {
        _debug('Fixing scopes...' + file.name);
        walk.simple(file.ast, {
            ObjectExpression: function(node, state) {
                var parent = infer.parentNode(node, file.ast);
                var grand = infer.parentNode(parent, file.ast);
                if (grand.type == 'Program') {
                    for (var i = 0; i < node.properties.length; ++i) {
                        var prop = node.properties[i],
                            name = infer.propName(prop);
                        if (node.properties[i].value.type == 'FunctionExpression') {
                            var val = node.properties[i].value;
                            var fn = val && val.scope && val.scope.fnType;
                            if (!fn || !fn.name) {
                                continue;
                            }

                            if (/Renderer.js$/.test(file.name)) {
                                //step 2, assign exported type to params
                                var cmp = fn.args[0];
                                var hlp = fn.args[1];
                                if (cmp) {
                                    findAndBindComponent(cmp, server, cx, infer);
                                }
                                if (hlp) {
                                    findAndBindHelper(hlp, server, modules, file);
                                }
                            } else if (/Helper.js$/.test(file.name)) {
                                //step 2, assign exported type to params
                                var cmp = fn.args[0];
                                if (cmp) {
                                    findAndBindComponent(cmp, server, cx, infer);
                                }
                            } else if (/Controller.js$/.test(file.name)) {
                                //step 2, assign exported type to params
                                var cmp = fn.args[0];
                                var evt = fn.args[1];
                                var hlp = fn.args[2];
                                if (evt) {
                                    findAndBindEvent(evt, server, cx, infer);
                                }
                                if (cmp) {
                                    findAndBindComponent(cmp, server, cx, infer);
                                }
                                if (hlp) {
                                    findAndBindHelper(hlp, server, modules, file);
                                }
                            }
                        }
                    }
                }
            },
        });
        _debug('All done ' + file.name);
    });

    server.finishAsyncAction();
}

function findAndBindEvent(type, server, cx, infer) {
    // this is slightly hacky, but have no idea how to get the event Otherwise
    var evs = cx.props['Event'];
    if (!evs) return;
    for (var z = 0; z < evs.length; z++) {
        var y = evs[z];
        if (y.name === 'Aura.Event') {
            var obj = y.props['Event'].types[0].props['prototype'].getObjType();
            var int = infer.getInstance(obj);
            int.propagate(type);
        }
    }
}

function findAndBindComponent(type, server, cx, infer) {
    var evs = cx.props['Component'];
    if (!evs) return;
    for (var z = 0; z < evs.length; z++) {
        var y = evs[z];
        if (y.name === 'Aura.Component') {
            var obj = y.props['Component'].types[0].props['prototype'].getObjType();
            var int = infer.getInstance(obj);
            int.propagate(type);
        }
    }
}

function findAndBindHelper(type, server, modules, file) {
    var helperFile = getHelper(file.name);
    var bn = trimExt(baseName(helperFile));
    var r = server.findFile(helperFile);
    if (!r) server.addFile(helperFile);
    var helper = modules.resolveModule(helperFile);
    //  console.log("Resolved module" + helperFile);
    //  console.dir(helper);
    var hp = helper.getProp(bn);
    if (!hp.getType()) {
        // this handles new props added to the helper...
        helper.on('addType', function(helperType, val) {
            var p = new ForAllProps_Purgeable(function(prop, val, local) {
                if (bn === prop) {
                    val.propagate(type);
                }
            });
            p.addSource(type);
            helperType.propagate(p);
        });
    } else {
        // now we need to handle there were changes to the .cmp,
        // but not the helper,
        var p = new ForAllProps_Purgeable(function(prop, val, local) {
            if (bn === prop) {
                val.propagate(type);
            }
        });
        p.addSource(type);
        helper.propagate(p);
    }
}

function getController(name) {
    return getName(name, 'Controller.js');
}

function getHelper(name) {
    return getName(name, 'Helper.js');
}

function getRenderer(name) {
    return getName(name, 'Renderer.js');
}

function getTest(name) {
    return getName(name, 'Test.js');
}

function getName(name, type) {
    var newname = name.replace(/Controller.js$|Helper.js$|Renderer.js$|Test.js$/, '') + type;
    return newname;
}

function resolver(file, parent) {
    return file;
}

function unloadDefs() {
    server.deleteDefs('Aura');
}

function isBlacklisted(filename) {
    var ret = filename.endsWith('/scrollerLib/bootstrap.js');
    ret = ret || filename.endsWith('ExportSymbolsHelper.js');
    return ret;
}

function readFileAsync(filename, c) {
    if (isBlacklisted(filename)) {
        c(null, '');
        return;
    }
    if (!filename.startsWith('/')) {
        filename = getFilename(filename);
    }

    if (filename.indexOf('.link') >= 0) {
        readFile(filename).then(function(contents) {
            c(null, contents);
        });
        return;
    }
    readFile(filename).then(function(contents) {
        c(null, contents);
    });
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

function loadDefs() {
    var defs = fs.readFileSync(path.join(__dirname, 'aura_types.json'), 'utf8');
    defs = JSON.parse(defs);
    server.addDefs(defs);
}

function safeFunction(fn) {
    return function() {
        try {
            fn.apply(this, arguments);
        } catch (e) {
            if (e instanceof infer.TimedOut) throw e;
            console.error(e);
        }
    };
}

tern.registerPlugin('aura', function(s, options) {
    server = s;
    if (!server.options.async) {
        throw Error('Server must be async');
    }
    server.options.getFile = readFileAsync;

    server.loadPlugin('modules');
    server.mod.modules.on('wrapScope', initScope);
    server.mod.modules.on('getExports', connectModule);
    server.mod.modules.resolvers.push(resolver);
    var currentQuery;
    server.on('completion', function(file, query) {
        // don't hijack the request to retrieve the standard completions
        if (currentQuery === query) {
            return;
        }
        currentQuery = query;
        // request the standard completions
        var filteredResult;
        query.docFormat = 'full';
        server.request(
            {
                query: query,
            },
            function(err, result) {
                if (err) {
                    _debug(err);
                }
                if (shouldFilter) {
                    result.completions = result.completions.filter(function(completion, index, array) {
                        var accepted =
                            (completion.doc && completion.doc.indexOf('@platform') !== -1 && completion.origin === 'Aura') || completion.origin !== 'Aura';
                        if (accepted && completion.doc) {
                            completion.doc = completion.doc.split('\n@')[0];
                            completion.doc = completion.doc.replace('@description', '');
                        }
                        return accepted;
                    });
                }
                filteredResult = result;
                // reset for future queries
                currentQuery = undefined;
            },
        );
        return filteredResult;
    });

    _debug('IDE mode');
    loadDefs();

    _debug(new Date().toISOString() + ' Done loading!');
});
tern.defineQueryType('ideInit', {
    run: function(server, query) {
        if (query.unloadDefs) {
            unloadDefs();
            _debug('Unloaded default Aura defs');
        }
        if (query.shouldFilter === true || query.shouldFilter === false) {
            shouldFilter = query.shouldFilter;
        }
        return 'OK';
    },
});
tern.defineQueryType('cleanup-file', {
    run: function(server, query) {
        var files = query.files;
        files.forEach(function(f) {
            var ff = f;
            if (ff.startsWith('/')) {
                ff = ff.slice(1);
            }
            var m = server.mod.modules.modules[ff];
            if (m) {
                m.purge(function(type) {
                    if (type instanceof ForAllProps_Purgeable) {
                        return false;
                    } else {
                        if (type.origin && type.origin === ff) {
                            return true;
                        }
                    }
                    return false;
                });
                delete server.mod.modules.modules[ff];
            }
        });
        return 'OK';
    },
});
tern.defineQueryType('guess-types', {
    takesFile: true,
    run: function(server, query, file) {
        if (!query.end) throw ternError('missing .query.end field');
        if (!query.property) throw ternError('missing .query.property field');
        var start = tern.resolvePos(file, query.end);
        var types = [];

        function gather(prop, obj, depth) {
            var val = obj.props[prop];
            var type = infer.toString(val.getType());
            types.push({
                property: prop,
                type: type,
                // The following causes J2V8 to crash
                //parent: obj.getType(),
                depth: depth,
            });
        }
        infer.forAllLocalsAt(file.ast, start, file.scope, gather);
        return {
            locals: types,
        };
    },
});
tern.defineQueryType('reset', {
    takesFile: false,
    run: function(server, query, file) {
        server.reset();
        return 'OK';
    },
});
