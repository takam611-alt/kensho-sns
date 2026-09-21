
const SUPABASE_URL = "https://afacytoanuhwedmbfvvf.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_NoaaAtRAVYGe5ObQDE5ByQ_Uw1Dq70F";
const AUTH_URL = `${SUPABASE_URL}/functions/v1/sns-auth`;
const API_URL = `${SUPABASE_URL}/functions/v1/sns-api`;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const APP_NAME = "ゆでたまSNS";

const state = {
  token: localStorage.getItem("kensho_session") || "",
  me: null,
  postType: "normal",
  postImagePath: null,
  currentPostId: null,
};

async function call(url, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json", "apikey": PUBLISHABLE_KEY },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(()=>({error:"通信エラー"}));
  if (!r.ok) throw new Error(data.error || "エラーが発生しました");
  return data;
}
async function api(action, extra={}) {
  return call(API_URL, { action, token:state.token, ...extra });
}
async function upload(file, kind) {
  const fd = new FormData();
  fd.append("action","upload_media");
  fd.append("token",state.token);
  fd.append("kind",kind);
  fd.append("file",file);
  const r = await fetch(API_URL,{method:"POST",headers:{"apikey":PUBLISHABLE_KEY},body:fd});
  const data = await r.json().catch(()=>({error:"アップロード失敗"}));
  if(!r.ok) throw new Error(data.error||"アップロード失敗");
  return data;
}
function esc(s=""){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function when(iso){const d=new Date(iso);return d.toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}
function initials(name=""){return esc(name.slice(0,1).toUpperCase()||"?")}
function avatarHTML(m,size=""){
  if(m?.avatar_url) return `<img class="avatar ${size}" src="${esc(m.avatar_url)}" alt="">`;
  return `<div class="avatar fallback ${size}">${initials(m?.display_name||"?")}</div>`;
}
function showAuth(msg=""){
  $("#authView").classList.remove("hidden"); $("#mainView").classList.add("hidden"); $("#authMsg").textContent=msg;
}
function showMain(){
  $("#authView").classList.add("hidden"); $("#mainView").classList.remove("hidden");
  const name = state.me?.display_name || "";
  if ($("#heroGreeting")) $("#heroGreeting").textContent = name ? `${name}さん、おかえり` : "おかえり";
  document.title = APP_NAME;
}
async function boot(){
  if(!state.token) return showAuth();
  try{
    const d=await call(AUTH_URL,{action:"me",token:state.token});
    state.me=d.member; showMain(); await loadFeed();
  }catch(e){
    localStorage.removeItem("kensho_session"); state.token=""; showAuth("もう一度ログインしてください");
  }
}
function setSession(d){
  state.token=d.session.token; state.me=d.member;
  localStorage.setItem("kensho_session",state.token);
  showMain(); loadFeed();
}

$("#loginTab").onclick=()=>{$("#loginTab").classList.add("active");$("#registerTab").classList.remove("active");$("#loginForm").classList.remove("hidden");$("#registerForm").classList.add("hidden")}
$("#registerTab").onclick=()=>{$("#registerTab").classList.add("active");$("#loginTab").classList.remove("active");$("#registerForm").classList.remove("hidden");$("#loginForm").classList.add("hidden")}

$("#loginForm").onsubmit=async e=>{
  e.preventDefault(); $("#authMsg").textContent="";
  try{setSession(await call(AUTH_URL,{action:"login",name:$("#loginName").value,pin:$("#loginPin").value}))}
  catch(err){$("#authMsg").textContent=err.message}
}
$("#registerForm").onsubmit=async e=>{
  e.preventDefault(); $("#authMsg").textContent="";
  try{setSession(await call(AUTH_URL,{action:"register",invite_code:$("#inviteCode").value,name:$("#registerName").value,pin:$("#registerPin").value}))}
  catch(err){$("#authMsg").textContent=err.message}
}

function typeLabel(t){return {kensho:"🎁 懸賞",win:"🎉 当選報告",poll:"📊 アンケート"}[t]||""}
function countOf(v){return Array.isArray(v)&&v[0]?.count ? v[0].count : 0}
async function loadFeed(){
  $("#feed").innerHTML='<div class="post-card"><div class="post-body">読み込み中…</div></div>';
  try{
    const d=await api("feed");
    if ($("#postCount")) $("#postCount").textContent = String(d.posts.length);
    try {
      const md = await api("members");
      if ($("#heroMemberCount")) $("#heroMemberCount").textContent = String(md.members.length);
    } catch {}
    if(!d.posts.length){$("#feed").innerHTML='<div class="post-card"><div class="post-body">まだ投稿がありません。最初の投稿をしてみよう！</div></div>';return}
    $("#feed").innerHTML=d.posts.map(p=>`
      <article class="post-card" data-id="${p.id}">
        <div class="post-head">${avatarHTML(p.members)}
          <div class="post-meta"><div class="post-name">${esc(p.members?.display_name||"")}</div><div class="post-time">${when(p.created_at)}</div></div>
        </div>
        <div class="post-body">${typeLabel(p.post_type)?`<span class="badge">${typeLabel(p.post_type)}</span><br>`:""}${esc(p.body||"")}</div>
        ${p.image_url?`<img class="post-image" src="${esc(p.image_url)}" alt="">`:""}
        <div class="post-actions">
          <button class="like-btn ${p.liked_by_me?"active":""}" data-id="${p.id}">♡ ${countOf(p.likes)}</button>
          <button class="comment-btn" data-id="${p.id}">💬 ${countOf(p.comments)}</button>
        </div>
      </article>`).join("");
    $$(".like-btn").forEach(b=>b.onclick=()=>toggleLike(b));
    $$(".comment-btn").forEach(b=>b.onclick=()=>openComments(b.dataset.id));
  }catch(e){$("#feed").innerHTML=`<div class="post-card"><div class="post-body">${esc(e.message)}</div></div>`}
}
async function toggleLike(btn){
  try{await api("toggle_like",{post_id:btn.dataset.id});await loadFeed()}catch(e){alert(e.message)}
}
async function openComments(id){
  state.currentPostId=id; $("#commentDialog").showModal(); await loadComments();
}
async function loadComments(){
  const d=await api("comments",{post_id:state.currentPostId});
  $("#commentsList").innerHTML=d.comments.length?d.comments.map(c=>`
    <div class="comment">${avatarHTML(c.members)}<div class="bubble"><strong>${esc(c.members?.display_name||"")}</strong><p>${esc(c.body)}</p></div></div>`).join(""):'<p>まだコメントはありません。</p>';
}
$("#commentForm").onsubmit=async e=>{
  e.preventDefault(); const v=$("#commentInput").value.trim(); if(!v)return;
  try{await api("add_comment",{post_id:state.currentPostId,body:v});$("#commentInput").value="";await loadComments();await loadFeed()}catch(err){alert(err.message)}
}

$$(".chip").forEach(c=>c.onclick=()=>{$$(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");state.postType=c.dataset.type});
$("#postImage").onchange=e=>{
  const f=e.target.files[0]; $("#postPreview").innerHTML=f?`<img src="${URL.createObjectURL(f)}" alt="">`:"";
}
$("#submitPost").onclick=async()=>{
  $("#postMsg").textContent="";
  try{
    let imagePath=null; const f=$("#postImage").files[0];
    if(f){$("#postMsg").textContent="画像をアップロード中…";imagePath=(await upload(f,"post")).path}
    await api("create_post",{body:$("#postBody").value,post_type:state.postType,image_path:imagePath});
    $("#postBody").value="";$("#postImage").value="";$("#postPreview").innerHTML="";$("#postMsg").textContent="投稿しました";
    await go("homePage"); await loadFeed();
  }catch(e){$("#postMsg").textContent=e.message}
}

async function loadMembers(){
  const d=await api("members"); $("#memberCount").textContent=`${d.members.length}人`;
  if ($("#heroMemberCount")) $("#heroMemberCount").textContent = String(d.members.length);
  $("#membersList").innerHTML=d.members.map(m=>`<div class="member-row">${avatarHTML(m)}<div><strong>${esc(m.display_name)}</strong>${m.bio?`<div class="member-bio">${esc(m.bio)}</div>`:""}</div></div>`).join("");
}
async function loadProfile(){
  const d=await api("profile"); const m=d.member; state.me=m;
  $("#profileName").value=m.display_name||"";$("#profileBio").value=m.bio||"";
  if(m.avatar_url){$("#profileAvatar").src=m.avatar_url;$("#profileAvatar").classList.remove("hidden");$("#profileFallback").classList.add("hidden")}
  else{$("#profileAvatar").classList.add("hidden");$("#profileFallback").classList.remove("hidden");$("#profileFallback").textContent=(m.display_name||"?").slice(0,1)}
}
$("#avatarInput").onchange=async e=>{
  const f=e.target.files[0]; if(!f)return; $("#profileMsg").textContent="アップロード中…";
  try{await upload(f,"avatar");$("#profileMsg").textContent="アイコンを変更しました";await loadProfile()}catch(err){$("#profileMsg").textContent=err.message}
}
$("#saveProfile").onclick=async()=>{
  $("#profileMsg").textContent="";
  try{await api("update_profile",{display_name:$("#profileName").value,bio:$("#profileBio").value});$("#profileMsg").textContent="保存しました";await loadProfile()}catch(e){$("#profileMsg").textContent=e.message}
}
$("#logoutBtn").onclick=async()=>{
  try{await call(AUTH_URL,{action:"logout",token:state.token})}catch{}
  localStorage.removeItem("kensho_session");state.token="";state.me=null;showAuth();
}
$("#refreshBtn").onclick=()=>loadFeed();

async function go(id){
  $$(".page").forEach(p=>p.classList.add("hidden"));$("#"+id).classList.remove("hidden");
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
  if(id==="membersPage")await loadMembers();
  if(id==="profilePage")await loadProfile();
}
$$(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.page));

boot();
