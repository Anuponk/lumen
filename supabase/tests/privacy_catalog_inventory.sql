-- Metadata only: no player rows, Auth identities, tokens or destructive SQL.
-- Run with a catalog-reading operator; this is not a deletion implementation.
with scope as (
 select c.oid,n.nspname as schema_name,c.relname as relation_name,
        c.relkind,c.relrowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where (n.nspname in ('lumen','lumen_commands')
        or (n.nspname='public' and left(c.relname,6)='lumen_'))
   and c.relkind in ('r','p','m','v')
)
select jsonb_build_object(
 'schemaOnly',true,
 'relations',coalesce((
  select jsonb_agg(jsonb_build_object(
   'schema',s.schema_name,'relation',s.relation_name,'kind',s.relkind,
   'rlsEnabled',s.relrowsecurity,
   'anonSelect',has_table_privilege('anon',s.oid,'SELECT'),
   'authenticatedSelect',has_table_privilege('authenticated',s.oid,'SELECT'),
   'authenticatedDelete',has_table_privilege('authenticated',s.oid,'DELETE'),
   'columns',coalesce((
    select jsonb_agg(jsonb_build_object('name',a.attname,
     'type',format_type(a.atttypid,a.atttypmod)) order by a.attnum)
    from pg_attribute a where a.attrelid=s.oid and a.attnum>0
     and not a.attisdropped
   ),'[]'::jsonb)
  ) order by s.schema_name,s.relation_name) from scope s
 ),'[]'::jsonb),
 'foreignKeys',coalesce((
  select jsonb_agg(jsonb_build_object(
   'constraint',con.conname,'sourceSchema',ns.nspname,
   'sourceTable',cl.relname,'targetSchema',nt.nspname,
   'targetTable',ct.relname,'onDelete',case con.confdeltype
    when 'c' then 'CASCADE' when 'n' then 'SET NULL'
    when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
    when 'd' then 'SET DEFAULT' end
  ) order by ns.nspname,cl.relname,con.conname)
  from pg_constraint con
  join pg_class cl on cl.oid=con.conrelid
  join pg_namespace ns on ns.oid=cl.relnamespace
  join pg_class ct on ct.oid=con.confrelid
  join pg_namespace nt on nt.oid=ct.relnamespace
  where con.contype='f'
   and (con.conrelid in (select oid from scope)
        or con.confrelid in (select oid from scope))
 ),'[]'::jsonb)
) as privacy_catalog;
