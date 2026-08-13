import type { Request, Response } from 'express';
import { syntheticTransactionMonitoring } from '../../../../lib/syntheticTransactionMonitoring.js';

const serialize=(value:unknown)=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));
export default async function handler(_req:Request,res:Response){
  return res.json(serialize({data:await syntheticTransactionMonitoring.list(),syntheticOnly:true,executionSource:'SIMULATION',filingsEnabled:false,financialActivationEffect:'NONE'}));
}

