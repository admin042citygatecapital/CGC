import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { financialSandbox } from '../../../../lib/financialSandboxStore.js';
import { SyntheticMonitoringError, syntheticTransactionMonitoring, type MonitoringActor } from '../../../../lib/syntheticTransactionMonitoring.js';

const serialize=(value:unknown)=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));
export default async function handler(req:Request,res:Response){
  const session=req.adminSession!;
  const actor:MonitoringActor={id:session.adminId,email:session.email,ip:req.ip,correlationId:String(req.get('X-Request-ID')??crypto.randomUUID()),actorType:'admin'};
  try{
    const action=String(req.body?.action??''); let result:unknown;
    if(action==='scan_velocity'){
      const transactions=(await financialSandbox.listTransactions({page:1,pageSize:500})).data;
      result=await syntheticTransactionMonitoring.scan(transactions,{...actor,id:'monitoring_engine',email:'system@local.invalid',actorType:'system'});
    }else if(action==='start_review'||action==='escalate'){
      result=await syntheticTransactionMonitoring.transition(String(req.body?.alertId??''),action==='escalate'?'escalated':'reviewing',String(req.body?.rationale??''),actor);
    }else if(action==='submit_resolution'){
      result=await syntheticTransactionMonitoring.submitResolution(String(req.body?.alertId??''),String(req.body?.rationale??''),actor);
    }else return res.status(400).json({error:'Unsupported monitoring action.',code:'INVALID_ACTION'});
    return res.json(serialize({ok:true,result}));
  }catch(error){const typed=error as Error&{code?:string;status?:number};if(error instanceof SyntheticMonitoringError)return res.status(typed.status??400).json({error:typed.message,code:typed.code});console.error('synthetic.monitoring.error',error);return res.status(500).json({error:'Synthetic monitoring action failed.',code:'INTERNAL_ERROR'});}
}

