import crypto from 'node:crypto';
import type { Request,Response } from 'express';
import { syntheticReconciliation,SyntheticReconciliationError } from '../../../lib/syntheticReconciliation.js';

const serialize=(value:unknown)=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));
export default async function handler(req:Request,res:Response){
  try{
    const exportRunId=String(req.query.exportRunId??'').trim();
    if(exportRunId){
      const session=req.adminSession!;const result=await syntheticReconciliation.export(exportRunId,{id:session.adminId,email:session.email,ip:req.ip,correlationId:String(req.get('X-Request-ID')??crypto.randomUUID()),actorType:'admin'});
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${result.record.filename}"`);res.setHeader('X-Evidence-SHA256',result.record.evidenceSha256);return res.send(result.content);
    }
    return res.json(serialize(await syntheticReconciliation.list()));
  }catch(error){if(error instanceof SyntheticReconciliationError)return res.status(error.status).json({error:error.message,code:error.code});console.error('synthetic.reconciliation.read.error',error);return res.status(500).json({error:'Reconciliation workspace could not be read.',code:'INTERNAL_ERROR'});}
}
