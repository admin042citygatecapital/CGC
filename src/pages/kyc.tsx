import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCustomerAuth } from '@/lib/customerAuth';

type KYCStatus = 'idle' | 'uploading' | 'pending' | 'approved' | 'rejected';
interface DocumentFile { file: File | null; preview: string; }

const STEPS = [
  { label: 'Create Account',        pct: 20  },
  { label: 'Upload Identification', pct: 40  },
  { label: 'Selfie Verification',   pct: 60  },
  { label: 'Compliance Review',     pct: 80  },
  { label: 'Approved',              pct: 100 },
];

function ProgressBar({ currentStep }: { currentStep: number }) {
  const step = Math.min(currentStep, STEPS.length - 1);
  return (
    <div className="w-full mb-8">
      <div className="flex items-start justify-between">
        {STEPS.map((s, i) => (
          <div key={i} className="flex flex-col items-center flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${i < currentStep ? 'bg-green-500 border-green-500 text-white' : i === currentStep ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100' : 'bg-white border-gray-300 text-gray-400'}`}>
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-1 text-center px-1 ${i === currentStep ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="relative h-2 bg-gray-200 rounded-full mt-3">
        <div className="absolute h-2 bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${STEPS[step].pct}%` }} />
      </div>
      <p className="text-right text-xs text-gray-400 mt-1">{STEPS[step].pct}% Complete</p>
    </div>
  );
}

function UploadGuidelines() {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm">
      <div>
        <h4 className="font-semibold text-green-700 mb-2">✅ Valid Examples</h4>
        <ul className="space-y-1 text-gray-700">
          {['Clear document photo','Full document visible','Good lighting','All 4 corners visible'].map(t=>(
            <li key={t} className="flex items-center gap-1"><span className="text-green-500">•</span>{t}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-red-700 mb-2">❌ Invalid Examples</h4>
        <ul className="space-y-1 text-gray-700">
          {['Cropped document','Blurry / out of focus','Reflection or glare','Expired ID','Damaged document'].map(t=>(
            <li key={t} className="flex items-center gap-1"><span className="text-red-500">•</span>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SupportModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/users/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: 'KYC Verification Delay', message, category: 'KYC Verification' }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError('Could not submit your ticket. Please try again.');
    }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {submitted ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Ticket Created</h3>
            <p className="text-gray-500 mb-4">Our support team will contact you shortly.</p>
            <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Close</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Contact Support</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input readOnly value="KYC Verification Delay" className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Describe your issue..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Submit Ticket</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessScreen() {
  return (
    <div className="text-center py-6">
      <div className="text-7xl mb-4 animate-bounce">✅</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Congratulations!</h2>
      <p className="text-xl text-gray-700 mb-1">Your identity has been verified successfully.</p>
      <p className="text-gray-400 mb-8">Your account is now fully verified and ready to use.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
        {[{emoji:'💰',label:'Fund Account',sub:'Make your first deposit',href:'/deposit'},{emoji:'👤',label:'Complete Profile',sub:'Add your profile details',href:'/profile'},{emoji:'🔒',label:'Enable Security Features',sub:'Set up 2FA and more',href:'/security'}].map(({emoji,label,sub,href})=>(
          <a key={href} href={href} className="block p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors">
            <div className="text-2xl mb-1">{emoji}</div>
            <h4 className="font-semibold text-gray-800 text-sm">{label}</h4>
            <p className="text-xs text-gray-500">{sub}</p>
          </a>
        ))}
      </div>
      <a href="/dashboard" className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">Go to Dashboard</a>
    </div>
  );
}

function getCorrectionList(reason: string): string[] {
  const r = (reason||'').toLowerCase();
  if (r.includes('blur')||r.includes('quality')) return ['Retake photos in good lighting','Ensure document is in sharp focus','Avoid camera shake'];
  if (r.includes('expir')) return ['Obtain a current valid government-issued ID','Ensure the expiry date is in the future'];
  if (r.includes('crop')||r.includes('corner')) return ['All four corners must be fully visible','Do not crop or cut off any part'];
  if (r.includes('selfie')||r.includes('face')||r.includes('match')) return ['Selfie must clearly show your face','Face must match the ID photo','Remove glasses and hats'];
  return ['Ensure documents are clear and fully visible','Provide a valid unexpired government ID','All document text must be legible'];
}

function RejectedScreen({ reason, onResubmit }: { reason: string; onResubmit: () => void }) {
  const corrections = getCorrectionList(reason);
  return (
    <div className="py-4">
      <div className="flex items-start gap-3 mb-5">
        <span className="text-4xl">❌</span>
        <div>
          <h2 className="text-2xl font-bold text-red-700">KYC Rejected — Action Required</h2>
          <p className="text-gray-500 text-sm mt-1">Please correct the issues and resubmit your documents</p>
        </div>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
        <h4 className="font-semibold text-red-800 mb-1 text-sm">Rejection Reason</h4>
        <p className="text-red-700 text-sm">{reason||'Your documents did not meet our verification requirements.'}</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-amber-800 mb-2 text-sm">Required Corrections</h4>
        <ul className="space-y-1">
          {corrections.map((c,i)=><li key={i} className="text-sm text-amber-900 flex items-start gap-1"><span className="text-amber-500">→</span>{c}</li>)}
        </ul>
      </div>
      <button onClick={onResubmit} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">Resubmit Documents</button>
    </div>
  );
}

function ReviewPending({ submittedAt, onSupportClick }: { submittedAt: number; onSupportClick: () => void }) {
  const [elapsed, setElapsed] = useState(()=>Math.floor((Date.now()-submittedAt)/1000));
  useEffect(()=>{ const iv=setInterval(()=>setElapsed(Math.floor((Date.now()-submittedAt)/1000)),5000); return ()=>clearInterval(iv); },[submittedAt]);
  const showDelayBanner = elapsed >= 600;
  return (
    <div className="text-center py-8">
      <div className="flex justify-center mb-6">
        <div className="relative w-16 h-16">
          <div className="w-16 h-16 border-4 border-blue-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Verification In Progress</h2>
      <p className="text-gray-600 mb-1">Most verifications are approved within <strong>5 minutes</strong>.</p>
      <p className="text-sm text-gray-400 mb-6">We'll notify you by email once complete. You can safely leave this page.</p>
      {showDelayBanner && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-left">
          <div className="flex items-center gap-2 mb-2"><span className="text-xl">⏳</span><h4 className="font-semibold text-amber-800">Verification Still Under Review</h4></div>
          <p className="text-sm text-amber-700 mb-3">Your verification is taking longer than usual. Our compliance team is reviewing your submission manually.</p>
          <button onClick={onSupportClick} className="px-5 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors">Contact Support</button>
        </div>
      )}
    </div>
  );
}

function FileUploadZone({ label, required, preview, icon, hint, accept, capture, inputRef, onFile }: {
  label: string; required?: boolean; preview: string; icon: string; hint: string;
  accept: string; capture?: 'user'|'environment'; inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}{required&&<span className="text-red-500 ml-1">*</span>}</label>
      <div onClick={()=>inputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
        {preview ? <img src={preview} alt={label} className="max-h-40 mx-auto rounded-lg object-contain" /> : (
          <><div className="text-3xl mb-2">{icon}</div><p className="text-gray-500 text-sm">{hint}</p><p className="text-gray-400 text-xs mt-1">JPG, PNG or PDF — Max 10 MB</p></>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} capture={capture} className="hidden" onChange={onFile} />
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function KYCPage() {
  const { token } = useCustomerAuth();
  const [currentStep,setCurrentStep]=useState(0);
  const [kycStatus,setKycStatus]=useState<KYCStatus>('idle');
  const [rejectionReason,setRejectionReason]=useState('');
  const [submittedAt,setSubmittedAt]=useState(0);
  const [showSupportModal,setShowSupportModal]=useState(false);
  const [isLoading,setIsLoading]=useState(false);
  const [error,setError]=useState('');
  const [frontDoc,setFrontDoc]=useState<DocumentFile>({file:null,preview:''});
  const [selfie,setSelfie]=useState<DocumentFile>({file:null,preview:''});
  const frontRef=useRef<HTMLInputElement>(null);
  const selfieRef=useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/users/kyc/status', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    return res.json() as Promise<{ kycStatus: string; rejectionReason: string; submittedAt: string | null }>;
  }, [token]);

  useEffect(()=>{
    if (!token) { setCurrentStep(1); return; }
    (async()=>{ try {
      const data = await fetchStatus();
      if(data.kycStatus==='approved'){setKycStatus('approved');setCurrentStep(4);}
      else if(data.kycStatus==='rejected'){setKycStatus('rejected');setRejectionReason(data.rejectionReason||'');}
      else if(data.kycStatus==='submitted'){setKycStatus('pending');setCurrentStep(3);setSubmittedAt(data.submittedAt?new Date(data.submittedAt).getTime():Date.now());}
      else setCurrentStep(1);
    } catch{setCurrentStep(1);}})();
  },[token,fetchStatus]);

  useEffect(()=>{
    if(kycStatus!=='pending'||!token)return;
    const iv=setInterval(async()=>{ try {
      const data = await fetchStatus();
      if(data.kycStatus==='approved'){setKycStatus('approved');setCurrentStep(4);clearInterval(iv);}
      else if(data.kycStatus==='rejected'){setKycStatus('rejected');setRejectionReason(data.rejectionReason||'');clearInterval(iv);}
    } catch { /* non-critical: a missed poll just retries in 15s */ }},15000);
    return()=>clearInterval(iv);
  },[kycStatus,token,fetchStatus]);

  const handleFile=(setter:React.Dispatch<React.SetStateAction<DocumentFile>>,advance?:boolean)=>(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file)return;
    setter({file,preview:URL.createObjectURL(file)});
    if(advance)setCurrentStep(s=>Math.max(s,2));
  };

  async function uploadDoc(docType: 'id' | 'selfie', file: File) {
    const fileData = await fileToBase64(file);
    const res = await fetch('/api/users/kyc/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ docType, filename: file.name, fileData, mimeType: file.type }),
    });
    if (!res.ok) throw new Error();
  }

  const handleSubmit=async()=>{
    if(!frontDoc.file||!selfie.file){setError('Please upload your ID document and selfie.');return;}
    setIsLoading(true);setError('');
    try{
      await uploadDoc('id', frontDoc.file);
      await uploadDoc('selfie', selfie.file);
      const res=await fetch('/api/users/kyc/submit',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok)throw new Error();
      setKycStatus('pending');setCurrentStep(3);setSubmittedAt(Date.now());
    }catch{setError('Submission failed. Please try again.');}
    finally{setIsLoading(false);}
  };

  const handleResubmit=()=>{
    setKycStatus('idle');setCurrentStep(1);
    setFrontDoc({file:null,preview:''});setSelfie({file:null,preview:''});
    setRejectionReason('');setError('');
  };

if(kycStatus==='approved')return(<div className="min-h-screen bg-gray-50 py-12 px-4"><div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8"><ProgressBar currentStep={4}/><SuccessScreen/></div></div>);
  if(kycStatus==='rejected')return(<div className="min-h-screen bg-gray-50 py-12 px-4"><div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8"><ProgressBar currentStep={1}/><RejectedScreen reason={rejectionReason} onResubmit={handleResubmit}/></div></div>);
  if(kycStatus==='pending')return(<div className="min-h-screen bg-gray-50 py-12 px-4"><div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8"><ProgressBar currentStep={3}/><ReviewPending submittedAt={submittedAt} onSupportClick={()=>setShowSupportModal(true)}/></div>{showSupportModal&&<SupportModal token={token} onClose={()=>setShowSupportModal(false)}/>}</div>);

  return(
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <ProgressBar currentStep={currentStep}/>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Identity Verification</h1>
        <p className="text-gray-500 mb-6 text-sm">Upload a government-issued photo ID and a selfie to verify your identity. Required by financial regulations.</p>
        <UploadGuidelines/>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 1: Upload ID Document</h3>
        <FileUploadZone label="Government-Issued ID" required preview={frontDoc.preview} icon="📄" hint="Click to upload your ID (passport, driver's license, etc.)" accept="image/*,.pdf" inputRef={frontRef} onFile={handleFile(setFrontDoc,true)}/>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-6">Step 2: Selfie Verification</h3>
        <p className="text-sm text-gray-500 mb-3">Look directly at the camera, remove glasses and hats, ensure good lighting.</p>
        <FileUploadZone label="Selfie" required preview={selfie.preview} icon="🤳" hint="Click to upload your selfie" accept="image/*" capture="user" inputRef={selfieRef} onFile={handleFile(setSelfie)}/>
        {error&&<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        <button onClick={handleSubmit} disabled={isLoading||!frontDoc.file||!selfie.file} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-4">
          {isLoading?<><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Submitting...</>:'Submit for Verification'}
        </button>
        <p className="text-center text-xs text-gray-400 mt-3">🔒 Your documents are encrypted and stored securely. We never share your information.</p>
      </div>
    </div>
  );
}
