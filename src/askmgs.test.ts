import {expect,it,vi} from 'vitest';
import {interpretAichatSlashCommand} from './utils/aichatSlashCommand';
it.each(['/askmgs prompt="質問 “△”"','/askmgs prompt=“質問 “△””'])('strips only the command and outer quotes: %s',async message=>{
 const askMuseGadget=vi.fn(async()=>({ok:true,reply:'Gadget answer'}));const direct=vi.fn(),tunnels=vi.fn();
 const result=await interpretAichatSlashCommand(message,new Date(),{askMuseGadget,askMuseDirect:direct,askTunnelSigner:tunnels} as never);
 expect(result).toMatchObject({handled:true,response:expect.stringContaining('Gadget answer')});expect(askMuseGadget).toHaveBeenCalledExactlyOnceWith('質問 “△”');expect(direct).not.toHaveBeenCalled();expect(tunnels).not.toHaveBeenCalled();
});
it('preserves inner quotes and newlines without decoding URLs or shell escapes',async()=>{
 const askMuseGadget=vi.fn(async()=>({ok:true,reply:'ok'}));await interpretAichatSlashCommand('/askmgs prompt="line 1\n"inner" %2F + \\n"',new Date(),{askMuseGadget} as never);
 expect(askMuseGadget).toHaveBeenCalledExactlyOnceWith('line 1\n"inner" %2F + \\n');
});
it('malformed input shows usage and never submits',async()=>{
 const askMuseGadget=vi.fn();expect(await interpretAichatSlashCommand('/askmgs prompt=unquoted',new Date(),{askMuseGadget} as never)).toMatchObject({handled:true,response:expect.stringContaining('使い方')});expect(askMuseGadget).not.toHaveBeenCalled();
});
