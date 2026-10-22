import {describe,it,expect} from 'vitest';
import {prepareImageRecord,loadImageRecords} from './containerImageRecords';
describe('イメージ比較用のJSON記録',()=>{
  it('同じ記録は同じハッシュになり、違う構成を上書きしない',async()=>{
    const db={prepare:(sql:string)=>({bind:(...args:unknown[])=>({sql,args})})};
    const record={schemaVersion:1 as const,kind:'image-manifest' as const,build:{buildUuid:'a'},measuredAt:null,features:{docker:false}};
    const a=await prepareImageRecord(db as any,record),b=await prepareImageRecord(db as any,record);
    expect(a.hash).toBe(b.hash);
    expect((await prepareImageRecord(db as any,{...record,features:{docker:true}})).hash).not.toBe(a.hash);
  });
  it('破損JSONを正常な比較データとして返さない',async()=>{
    const db={prepare:()=>({all:async()=>({results:[{record_hash:'bad',record_json:'{}'}]})})};
    await expect(loadImageRecords(db as any)).rejects.toThrow('checksum');
  });
});
