import type { Request, Response } from 'express';
import { listAssuranceExercises, AssuranceExerciseError } from '../../../lib/assuranceExerciseStore.js';
export default async function handler(_req:Request,res:Response){ try{return res.json(await listAssuranceExercises());}catch(error){if(error instanceof AssuranceExerciseError)return res.status(error.status).json({error:error.message,code:error.code});console.error('assurance.list.error',error);return res.status(500).json({error:'Unable to list assurance exercises.'});} }
