import {beforeEach,expect,it,vi} from 'vitest';
const calls=vi.hoisted(()=>({state:{status:'stopped',lastChange:1},start:vi.fn(),stop:vi.fn()}));
vi.mock('@cloudflare/containers',()=>({Container:class{
 envVars={};
 async getState(){return {...calls.state};}
 async start(){await calls.start();calls.state={status:'running',lastChange:2};}
 async stop(){await calls.stop();calls.state={status:'stopped',lastChange:3};}
}}));
import {DemoContainer} from './demoContainer';
beforeEach(()=>{calls.state={status:'stopped',lastChange:1};calls.start.mockReset();calls.stop.mockReset();});
const container=()=>new DemoContainer({} as never,{} as never);
it('start/stop round trip and repeated desired states are idempotent',async()=>{
 const instance=container();expect(await instance.setRunning(true)).toMatchObject({changed:true,state:{status:'running'}});
 expect(await instance.setRunning(true)).toMatchObject({changed:false});expect(calls.start).toHaveBeenCalledTimes(1);
 expect(await instance.setRunning(false)).toMatchObject({changed:true,state:{status:'stopped'}});
 expect(await instance.setRunning(false)).toMatchObject({changed:false});expect(calls.stop).toHaveBeenCalledTimes(1);
});
it('shares the lock with management-page start/stop/restart and releases after failure',async()=>{
 let release!:()=>void;calls.start.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve;}));
 const instance=container();const pending=instance.setRunning(true);
 await vi.waitFor(()=>expect(calls.start).toHaveBeenCalledOnce());
 await expect(instance.stop()).rejects.toThrow('別の操作');await expect(instance.restart()).rejects.toThrow('別の操作');await expect(instance.setRunning(false)).rejects.toThrow('別の操作');
 release();await pending;await instance.setRunning(false);
 calls.start.mockRejectedValueOnce(new Error('start failed'));await expect(instance.setRunning(true)).rejects.toThrow('start failed');await expect(instance.setRunning(true)).resolves.toMatchObject({changed:true});
});
it('does not infer stopped from unknown state, and does not start while stopping',async()=>{
 const instance=container();calls.state={status:'unknown',lastChange:1};await expect(instance.setRunning(true)).rejects.toThrow('状態');
 calls.state={status:'stopping',lastChange:1};await expect(instance.setRunning(true)).rejects.toThrow('停止処理中');
 expect(await instance.setRunning(false)).toMatchObject({changed:false,state:{status:'stopping'}});
 await expect(instance.setRunning('yes' as never)).rejects.toThrow('不正');expect(calls.start).not.toHaveBeenCalled();
});
