import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function postgresBin() {
    try{return execFileSync('pg_config',['--bindir'],{encoding:'utf8',stdio:'pipe'}).trim();}catch{return '';}
}

test('catalog bucket migration with real PostgreSQL and inherited permissive policies',async t=>{
    const bin=postgresBin();
    if(!bin){t.skip('PostgreSQL binaries are required for the isolated RLS acceptance test');return;}
    try{await fs.access(path.join(bin,'initdb'));}catch{t.skip('PostgreSQL server binaries are unavailable');return;}
    const dir=await fs.mkdtemp('/tmp/dw-catalog-pg-');const data=path.join(dir,'data');let started=false;
    const run=(cmd,args)=>execFileSync(path.join(bin,cmd),args,{encoding:'utf8',stdio:'pipe',timeout:30000});
    const sql=query=>run('psql',['-X','-h',dir,'-p','54329','-U','catalog_test_admin','-d','postgres','-Atq','-v','ON_ERROR_STOP=1','-c',query]).trim();
    try{
        run('initdb',['-D',data,'-U','catalog_test_admin','--auth=trust','--no-locale']);
        run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -p 54329 -c listen_addresses=''`,'-w','start']);started=true;
        sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
            CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
            CREATE TABLE storage.objects(id int primary key,bucket_id text references storage.buckets(id),name text);
            ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
            GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
            GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated,service_role;`);
        sql(await fs.readFile(new URL('../migrations/0003_storage_buckets_rls.sql',import.meta.url),'utf8'));
        sql("INSERT INTO storage.objects VALUES(1,'raw','private'),(2,'results','result');");
        const before=sql("SELECT json_agg(b ORDER BY id) FROM storage.buckets b;");
        const migration=await fs.readFile(new URL('../migrations/0043_catalog_wheels_public_read.sql',import.meta.url),'utf8');
        await t.test('creates only the new bucket with a restrictive client policy',()=>{
            sql(migration);
            assert.equal(sql("SELECT public AND file_size_limit=8388608 FROM storage.buckets WHERE id='catalog-wheels';"),'t');
            assert.equal(sql("SELECT polpermissive FROM pg_policy WHERE polname='catalog wheels: clients no access';"),'f');
            assert.equal(sql("SELECT json_agg(b ORDER BY id) FROM storage.buckets b WHERE id<>'catalog-wheels';"),before);
            sql("INSERT INTO storage.objects VALUES(3,'catalog-wheels','source');");
        });
        await t.test('anon cannot delete a catalog object through the old broad ALL policy',()=>{
            assert.equal(sql("SET ROLE anon; WITH changed AS (DELETE FROM storage.objects WHERE id=3 RETURNING id) SELECT count(*) FROM changed;"),'0');
            assert.equal(sql('SELECT count(*) FROM storage.objects WHERE id=3;'),'1');
        });
        await t.test('both client roles cannot insert, update, list or move catalog objects',()=>{
            for(const role of ['anon','authenticated']){
                assert.throws(()=>sql(`SET ROLE ${role}; INSERT INTO storage.objects VALUES(4,'catalog-wheels','bad');`),error=>String(error.stderr).includes('row-level security'));
                assert.equal(sql(`SET ROLE ${role}; WITH changed AS (UPDATE storage.objects SET bucket_id='results' WHERE id=3 RETURNING id) SELECT count(*) FROM changed;`),'0');
                assert.equal(sql(`SET ROLE ${role}; SELECT count(*) FROM storage.objects WHERE bucket_id='catalog-wheels';`),'0');
            }
        });
        await t.test('trusted service role retains write access and user buckets retain their policy behavior',()=>{
            assert.equal(sql("SET ROLE service_role; WITH changed AS (UPDATE storage.objects SET name='approved' WHERE id=3 RETURNING id) SELECT count(*) FROM changed;"),'1');
            assert.equal(sql("SET ROLE anon; SELECT count(*) FROM storage.objects WHERE bucket_id='raw';"),'0');
            assert.equal(sql("SET ROLE anon; SELECT count(*) FROM storage.objects WHERE bucket_id='results';"),'1');
        });
        await t.test('migration is idempotent and does not replace catalog objects',()=>{
            sql(migration);assert.equal(sql("SELECT name FROM storage.objects WHERE id=3;"),'approved');
            assert.equal(sql("SELECT count(*) FROM pg_policy WHERE polname='catalog wheels: clients no access';"),'1');
        });
        await t.test('a conflicting existing bucket fails without changing its exposure or other buckets',()=>{
            sql("UPDATE storage.buckets SET public=false WHERE id='catalog-wheels';");
            assert.throws(()=>sql(migration),error=>String(error.stderr).includes('does not match reviewed configuration'));
            assert.equal(sql("SELECT public FROM storage.buckets WHERE id='catalog-wheels';"),'f');
            assert.equal(sql("SELECT json_agg(b ORDER BY id) FROM storage.buckets b WHERE id<>'catalog-wheels';"),before);
        });
    }finally{
        if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
        await fs.rm(dir,{recursive:true,force:true});
    }
});
