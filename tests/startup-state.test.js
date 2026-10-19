const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
const extract = (name) => {
  const at = source.indexOf(`function ${name}(`);
  return (source.slice(at - 6, at) === 'async ' ? 'async ' : '') + source.slice(at, source.indexOf('\n}', at) + 2);
};
async function check() {
  const empty = vm.runInNewContext(`${extract('createEmptyState')}; createEmptyState()`);
  assert.equal(empty.orders.length, 0);
  assert.equal(empty.activities.length, 0);
  for (const success of [true, false]) {
    const ctx = { success, statuses: [], polls: 0, renders: 0, console };
    vm.createContext(ctx);
    vm.runInContext(`let isAppDataInitialized=false; let appDataInitializationPromise=null;
      const REQUIRE_GLOBAL_LOGIN=false;
      function setStartupState(value){ statuses.push(value); }
      async function loadRemoteState(){return success;}
      function render(){renders++;} function startStatePolling(){polls++;}
      ${extract('initializeAppData')}
      globalThis.run=initializeAppData();`, ctx);
    assert.equal(await ctx.run, success);
    assert.equal(vm.runInContext('isAppDataInitialized', ctx), success);
    assert.equal(ctx.polls, success ? 1 : 0);
    assert.equal(ctx.renders, success ? 1 : 0);
    assert.equal(ctx.statuses.at(-1), success ? 'ready' : 'error');
  }
  for (const remote of [null, {}, {orders: 'invalid'}]) {
    const ctx = {
      remote, applied: 0, stateReadGeneration: 0, stateDisplayReadPromise: null,
      AbortController, isSupabaseBackend:()=>false, canReadRemoteState:()=>true,
      waitForServerRead:async(value)=>value, fetchApiState:async()=>remote,
      normalizeAppState:(value)=>value, console: {error(){}},
      applyIncomingState:()=>ctx.applied++, showAppAlert:()=>{}
    };
    vm.createContext(ctx);
    vm.runInContext(`${extract('readRemoteStateForDisplay')}\n${extract('loadRemoteState')}; globalThis.run=loadRemoteState();`, ctx);
    assert.equal(await ctx.run, false);
    assert.equal(ctx.applied, 0);
  }
  assert.match(extract('fetchSupabaseState'), /throw new Error\("Server state is missing/);
  assert.match(extract('handleGlobalLogin'), /if \(await initializeAppData\(\) === false\) return/);
  console.log('startup empty state, loading success/failure and missing payload tests passed');
}
check().catch((error)=>{console.error(error);process.exitCode=1;});
