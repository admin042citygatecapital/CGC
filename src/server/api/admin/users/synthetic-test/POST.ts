import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { getDb } from '../../../../db/db.js';
import { auditLog, onboardingCases, onboardingProviderEvents, transactions, users } from '../../../../db/schema.js';
import { authorizeAdminRole, authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  if (!authorizeAdminRole(req, res, 'SUPER_ADMIN')) return;
  if (!authorizeRecentAdminStepUp(req, res)) return;
  const userId=String(req.body?.userId??'');
  const reason=sanitizeNote(req.body?.reason??'').slice(0,1000);
  if (!userId || reason.length<10 || req.body?.confirmed!==true) return res.status(400).json({error:'Customer, explicit confirmation, and a reason of at least 10 characters are required.'});
  const db=getDb();
  try {
    const result=await db.transaction(async tx=>{
      const [customer]=await tx.select().from(users).where(eq(users.id,userId)).limit(1);
      if(!customer) throw Object.assign(new Error('Customer not found.'),{code:'NOT_FOUND'});
      if(customer.status==='active'||Number(customer.balance??0)!==0||customer.bankAccountNumber||customer.bankIban||customer.walletBtc||customer.walletEth||customer.walletUsdt||customer.walletSol){
        throw Object.assign(new Error('This record has account, balance, payment, or wallet data and cannot be classified as synthetic.'),{code:'SYNTHETIC_CLASSIFICATION_REFUSED'});
      }
      const [transaction]=await tx.select({id:transactions.id}).from(transactions).where(eq(transactions.userId,userId)).limit(1);
      if(transaction) throw Object.assign(new Error('This record has transaction history and cannot be classified as synthetic.'),{code:'SYNTHETIC_CLASSIFICATION_REFUSED'});
      const cases=await tx.select({id:onboardingCases.id}).from(onboardingCases).where(eq(onboardingCases.userId,userId));
      for(const record of cases){
        const [provider]=await tx.select({id:onboardingProviderEvents.id}).from(onboardingProviderEvents).where(eq(onboardingProviderEvents.caseId,record.id)).limit(1);
        if(provider) throw Object.assign(new Error('This record has provider identifiers and cannot be classified as synthetic.'),{code:'SYNTHETIC_CLASSIFICATION_REFUSED'});
      }
      const changed=await tx.update(users).set({dataClassification:'synthetic_test',updatedAt:new Date()}).where(and(eq(users.id,userId),eq(users.dataClassification,customer.dataClassification))).returning({id:users.id,email:users.email});
      if(!changed[0]) throw Object.assign(new Error('Customer changed. Refresh before classifying.'),{code:'WORKFLOW_CONFLICT'});
      const session=req.adminSession!;
      await tx.insert(auditLog).values({id:`al_${crypto.randomBytes(8).toString('hex')}`,adminId:session.adminId,adminEmail:session.email,action:'admin_customer_classified_synthetic_test',target:'user',targetId:userId,details:{reason,result:'success',previousClassification:customer.dataClassification,newClassification:'synthetic_test',financialProviderCallsBlocked:true},ip:req.ip??null,ts:new Date()});
      return changed[0];
    });
    return res.json({ok:true,userId:result.id,classification:'synthetic_test'});
  } catch(error){const typed=error as Error&{code?:string};return res.status(typed.code==='NOT_FOUND'?404:409).json({error:typed.message,code:typed.code});}
}
