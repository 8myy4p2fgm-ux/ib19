// Small SQLite/D1-compatible store. Atomic SQL bounds writes even under concurrent requests.
export function createPlaylistStore(db){
 const first=(sql,args=[])=>db.prepare(sql).bind(...args).first();
 const run=(sql,args=[])=>db.prepare(sql).bind(...args).run();
 return {
  get:id=>first('SELECT id,payload,created_at FROM playlist_shares WHERE id=?',[id]),
  byRequest:requestId=>first('SELECT id,payload,created_at FROM playlist_shares WHERE request_id=?',[requestId]),
  async allow(clientKey,now,{perMinute=5,perDay=100}={}){
   await run('DELETE FROM playlist_share_limits WHERE expires<=?',[now]);
   for(const [span,max]of [[60000,perMinute],[86400000,perDay]]){
    const start=Math.floor(now/span)*span;
    const row=await first('INSERT INTO playlist_share_limits(key,hits,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 WHERE hits<? RETURNING hits',[clientKey+':'+span+':'+start,start+span,max]);
    if(!row)return false;
   }return true;
  },
  async insert(record,{maxShares=10000,maxBytes=64*1024*1024}={}){
   return first('INSERT INTO playlist_shares(id,request_id,payload,payload_bytes,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM playlist_shares)<? AND (SELECT COALESCE(SUM(payload_bytes),0) FROM playlist_shares)+?<=? RETURNING id',
    [record.id,record.requestId,record.payload,record.bytes,record.createdAt,maxShares,record.bytes,maxBytes]);
  }
 };
}
