// #316: mandatory read-only deployment preflight. Run using the private
// operator connection before exposing the destructive HTTP endpoint.
// Never auto-apply migrations or grant privileges here.
export async function assertPrivateErasureDatabaseReady({query}) {
 if(typeof query!=='function')throw Error('Private operator query required');
 const r=await query(`select current_user as db_user,session_user as session_user,
   auth.uid()::text as auth_user,
   to_regprocedure('lumen_privacy.review_erasure(uuid,text[])') is not null as has_review,
   to_regprocedure('lumen_privacy.erase_account(uuid,text[],text)') is not null as has_erase,
   to_regclass('lumen_privacy.reauth_proofs') is not null as has_reauth,
   to_regclass('lumen_privacy.verified_actor_ownership') is not null as has_ownership,
   has_schema_privilege('authenticated','lumen_privacy','USAGE') as authenticated_schema_usage,
   has_schema_privilege('service_role','lumen_privacy','USAGE') as service_schema_usage,
   has_table_privilege('authenticated','lumen_privacy.reauth_proofs','SELECT') as authenticated_proof_read,
   has_table_privilege('service_role','lumen_privacy.verified_actor_ownership','SELECT') as service_ownership_read`);
 const row=r.rows?.[0];
 if(!row||row.db_user!=='postgres'||row.session_user!=='postgres'||row.auth_user!==null||
   row.has_review!==true||row.has_erase!==true||row.has_reauth!==true||row.has_ownership!==true||
   row.authenticated_schema_usage!==false||row.service_schema_usage!==false||
   row.authenticated_proof_read!==false||row.service_ownership_read!==false)
   throw Error('Private erasure database preflight failed');
 return true;
}
