// Only protocol codes enter diagnostics/retry metadata, never provider messages,
// details, tokens or payloads. Review means "needs attention", not lost/invalid.
export function classifyCanonicalRecoveryError(error,status=error?.httpStatus??error?.status){
 const raw=error?.code;
 const code=typeof raw==='string'&&(/^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(raw)||raw==='LUMEN_QUEST_UNAVAILABLE')?raw:'UNKNOWN';
 if(Number.isInteger(status)&&(status>=500||status===408||status===429))return {kind:'retry',code};
 if(status===401||['PGRST301','PGRST302','PGRST303'].includes(code))return {kind:'auth',code};
 if([400,403,404,413,422].includes(status)||['P0001','42501','22023','22P02','23514','PGRST102','PGRST202','LUMEN_QUEST_UNAVAILABLE'].includes(code))return {kind:'review',code};
 return {kind:'retry',code};
}
export function canonicalRecoveryFailure(error,status=error?.httpStatus??error?.status){
 const failure=new Error('Canonical ledger commit unconfirmed');
 const classification=classifyCanonicalRecoveryError(error,status);
 failure.code=classification.code;failure.recoveryKind=classification.kind;
 if(Number.isInteger(status))failure.httpStatus=status;
 if(classification.kind==='auth')failure.retryScope='session';
 return failure;
}
