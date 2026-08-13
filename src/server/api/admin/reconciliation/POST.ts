import crypto from 'node:crypto';
import type { Request,Response } from 'express';
import { financialSandbox } from '../../../lib/financialSandboxStore.js';
import { moneyMovementSimulation } from '../../../lib/moneyMovementSimulation.js';
import { syntheticReconciliation,SyntheticReconciliationError,type ReconciliationActor } from '../../../lib/syntheticReconciliation.js';

const serialize=(value:unknown)=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));
export default async function handler(req:Request,res:Response){const session=req.adminSession!;const actor:ReconciliationActor={id:session.adminId,email:session.email,ip:req.ip,correlationId:String(req.get('X-Request-ID')??crypto.randomUUID()),actorType:'admin'};try{const action=String(req.body?.action??'');let result:unknown;
  if(action==='run'){const summaries=(await financialSandbox.listTransactions({page:1,pageSize:500})).data;const transactions=await Promise.all(summaries.map(item=>financialSandbox.getTransaction(item.id)));const instructions=await moneyMovementSimulation.list({limit:500});result=await syntheticReconciliation.run(transactions,instructions,String(req.body?.businessDate??new Date().toISOString().slice(0,10)),actor);}
  else if(action==='investigate'||action==='escalate')result=await syntheticReconciliation.investigate(String(req.body?.exceptionId??''),{owner:String(req.body?.owner??''),notes:String(req.body?.notes??''),escalate:action==='escalate'},actor);
  else if(action==='submit_resolution')result=await syntheticReconciliation.submitResolution(String(req.body?.exceptionId??''),String(req.body?.proposal??''),actor);
  else return res.status(400).json({error:'Unsupported reconciliation action.',code:'INVALID_ACTION'});
  return res.json(serialize({ok:true,result,financialOperationsLocked:true}));
}catch(error){if(error instanceof SyntheticReconciliationError)return res.status(error.status).json({error:error.message,code:error.code});console.error('synthetic.reconciliation.error',error);return res.status(500).json({error:'Reconciliation action failed.',code:'INTERNAL_ERROR'});}}
