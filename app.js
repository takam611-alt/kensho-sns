
const SUPABASE_URL = "https://afacytoanuhwedmbfvvf.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_NoaaAtRAVYGe5ObQDE5ByQ_Uw1Dq70F";
const AUTH_URL = `${SUPABASE_URL}/functions/v1/sns-auth`;
const API_URL = `${SUPABASE_URL}/functions/v1/sns-api`;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const APP_NAME = "ゆでたまSNS";

const savedTheme = localStorage.getItem("yudetama_theme") || "light";
document.body.dataset.theme = savedTheme;

function applyTheme(theme){
  document.body.dataset.theme = theme;
  localStorage.setItem("yudetama_theme", theme);
  $$(".theme-option").forEach(b => b.classList.toggle("active", b.dataset.theme === theme));
}

async function hideLoading(immediate = false){
  const loader = document.querySelector("#loadingView");
  if (!loader) return;
  if (!immediate) {
    await new Promise(r => setTimeout(r, 120));
  }
  loader.classList.add("hidden");
}

function setShellLoading(isLoading){
  const loading = document.querySelector("#feedLoading");
  const feed = document.querySelector("#feed");
  if (loading) loading.classList.toggle("hidden", !isLoading);
  if (feed) feed.classList.toggle("hidden", isLoading);
}

const REGISTER_CODE = "472B76AEED";

const state = {
  token: localStorage.getItem("kensho_session") || "",
  me: null,
  postType: "normal",
  postImagePath: null,
  currentPostId: null,
  talkPeer: null,
  talkTimer: null,
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
async function showAuth(msg=""){
  $("#authMsg").textContent=msg;
  const auth = $("#authView");
  const main = $("#mainView");
  auth.hidden = false;
  auth.classList.remove("hidden");
  main.hidden = true;
  main.classList.add("hidden");
  await hideLoading(false);
}
async function showMain(){
  const auth = $("#authView");
  const main = $("#mainView");
  auth.hidden = true;
  auth.classList.add("hidden");
  main.hidden = false;
  main.classList.remove("hidden");
  setShellLoading(true);
  document.title = APP_NAME;
  await hideLoading(true);
}
async function boot(){
  if(!state.token) return await showAuth();
  try{
    await showMain();
    const d=await call(AUTH_URL,{action:"me",token:state.token});
    state.me=d.member;
    await loadFeed();
    loadTalkList().catch(()=>{});
  }catch(e){
    localStorage.removeItem("kensho_session");
    state.token="";
    await showAuth("もう一度ログインしてください");
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
  try{setSession(await call(AUTH_URL,{action:"register",invite_code:REGISTER_CODE,name:$("#registerName").value,pin:$("#registerPin").value}))}
  catch(err){$("#authMsg").textContent=err.message}
}

function countOf(v){return Array.isArray(v)&&v[0]?.count ? v[0].count : 0}
async function loadFeed(){
  setShellLoading(true);
  try{
    const d=await api("feed");

    if(!d.posts.length){
      $("#feed").innerHTML='<div class="post-card"><div class="post-body">まだ投稿がありません。最初の投稿をしてみよう！</div></div>';
      setShellLoading(false);
      return
    }
    $("#feed").innerHTML=d.posts.map(p=>`
      <article class="post-card" data-id="${p.id}">
        <div class="post-head">${avatarHTML(p.members)}
          <div class="post-meta"><div class="post-name">${esc(p.members?.display_name||"")}</div><div class="post-time">${when(p.created_at)}</div></div>
          ${p.can_delete?`<button class="post-menu-btn" data-id="${p.id}" aria-label="投稿メニュー">•••</button>
          <div class="post-menu hidden" data-menu="${p.id}"><button class="delete-post-btn" data-id="${p.id}">投稿を削除</button></div>`:""}
        </div>
        <div class="post-body">${esc(p.body||"")}</div>
        ${p.image_url?`<img class="post-image" src="${esc(p.image_url)}" alt="">`:""}
        <div class="post-actions">
          <button class="comment-btn" data-id="${p.id}">💬 ${countOf(p.comments)}</button>
          <button class="like-btn ${p.liked_by_me?"active":""}" data-id="${p.id}">♡ ${countOf(p.likes)}</button>
        </div>
      </article>`).join("");
    $$(".like-btn").forEach(b=>b.onclick=()=>toggleLike(b));
    $$(".comment-btn").forEach(b=>b.onclick=()=>openComments(b.dataset.id));
    $$(".post-menu-btn").forEach(b=>b.onclick=(e)=>{
      e.stopPropagation();
      const m=document.querySelector(`[data-menu="${b.dataset.id}"]`);
      $$(".post-menu").forEach(x=>{if(x!==m)x.classList.add("hidden")});
      m?.classList.toggle("hidden");
    });
    $$(".delete-post-btn").forEach(b=>b.onclick=()=>deletePost(b.dataset.id));
    setShellLoading(false);
  }catch(e){
    $("#feed").innerHTML=`<div class="post-card"><div class="post-body">${esc(e.message)}</div></div>`;
    setShellLoading(false);
  }
}
async function deletePost(id){
  if(!confirm("この投稿を削除しますか？")) return;
  try{
    await api("delete_post",{post_id:id});
    document.querySelector(`.post-card[data-id="${id}"]`)?.remove();
  }catch(e){ alert(e.message); }
}

async function toggleLike(btn){
  if(btn.disabled) return;
  btn.disabled = true;
  const wasLiked = btn.classList.contains("active");
  const current = Number((btn.textContent.match(/\d+/)||[0])[0]);
  const optimisticLiked = !wasLiked;
  const optimisticCount = Math.max(0, current + (optimisticLiked ? 1 : -1));
  btn.classList.toggle("active", optimisticLiked);
  btn.textContent = `♡ ${optimisticCount}`;
  try{
    const d = await api("toggle_like",{post_id:btn.dataset.id});
    const finalLiked = !!d.liked;
    if(finalLiked !== optimisticLiked){
      const finalCount = Math.max(0, optimisticCount + (finalLiked ? 1 : -1));
      btn.classList.toggle("active", finalLiked);
      btn.textContent = `♡ ${finalCount}`;
    }
  }catch(e){
    btn.classList.toggle("active", wasLiked);
    btn.textContent = `♡ ${current}`;
    alert(e.message);
  }finally{
    btn.disabled = false;
  }
}
async function openComments(id){
  state.currentPostId=id; $("#commentDialog").showModal(); await loadComments();
}
async function loadComments(){
  const d=await api("comments",{post_id:state.currentPostId});
  $("#commentsList").innerHTML=d.comments.length?d.comments.map(c=>`
    <div class="comment">${avatarHTML(c.members)}<div class="bubble"><strong>${esc(c.members?.display_name||"")}</strong><p>${esc(c.body)}</p></div></div>`).join(""):'<p class="comments-empty">まだコメントはありません。</p>';
}
$("#commentForm").onsubmit=async e=>{
  e.preventDefault();
  const input = $("#commentInput");
  const v = input.value.trim();
  if(!v) return;
  const submit = e.currentTarget.querySelector("button[type=submit], button");
  if(submit) submit.disabled = true;
  try{
    await api("add_comment",{post_id:state.currentPostId,body:v});
    input.value = "";
    await loadComments();
    const feedBtn = document.querySelector(`.comment-btn[data-id="${state.currentPostId}"]`);
    if(feedBtn){
      const current = Number((feedBtn.textContent.match(/\d+/)||[0])[0]);
      feedBtn.textContent = `💬 ${current + 1}`;
    }
  }catch(err){
    alert(err.message);
  }finally{
    if(submit) submit.disabled = false;
  }
}



function talkTime(iso){
  const d=new Date(iso);
  const now=new Date();
  return d.toDateString()===now.toDateString()
    ? d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})
    : d.toLocaleDateString("ja-JP",{month:"numeric",day:"numeric"});
}
function updateTalkBadge(n){
  const badge=$("#talkBadge");
  if(!badge)return;
  badge.textContent=String(Math.min(n,99));
  badge.classList.toggle("hidden", !n);
}
async function loadTalkList(){
  const box=$("#talkList");
  box.innerHTML='<div class="post-card"><div class="post-body">読み込み中…</div></div>';
  try{
    const d=await api("talk_list");
    updateTalkBadge(d.unread_total||0);
    $("#talkUnread").textContent=d.unread_total?`未読 ${d.unread_total}`:"";
    box.innerHTML=d.conversations.length?d.conversations.map(c=>`
      <div class="talk-row-wrap" data-peer-wrap="${c.peer.id}">
        <button class="talk-row" data-peer="${c.peer.id}">
          ${avatarHTML(c.peer)}
          <div class="talk-row-main">
            <div class="talk-row-name">${esc(c.peer.display_name)}</div>
            <div class="talk-row-preview">${esc(c.last_message.body||"")}</div>
          </div>
          <div class="talk-row-meta">
            <span class="talk-row-time">${talkTime(c.last_message.created_at)}</span>
            ${c.unread_count?`<span class="talk-unread">${c.unread_count}</span>`:""}
          </div>
        </button>
        <button class="talk-delete-btn" data-peer="${c.peer.id}" aria-label="トークを削除">•••</button>
      </div>`).join(""):'<div class="post-card"><div class="post-body">まだトークはありません。</div></div>';
    $$(".talk-row").forEach(b=>b.onclick=()=>openTalk(b.dataset.peer));
    $$(".talk-delete-btn").forEach(b=>b.onclick=async e=>{
      e.stopPropagation();
      if(!confirm("このトークを一覧から削除しますか？\n相手側の履歴は削除されません。")) return;
      try{
        await api("hide_talk",{peer_id:b.dataset.peer});
        document.querySelector(`[data-peer-wrap="${b.dataset.peer}"]`)?.remove();
        await loadTalkList();
      }catch(err){ alert(err.message); }
    });
  }catch(e){
    box.innerHTML=`<div class="post-card"><div class="post-body">${esc(e.message)}</div></div>`;
  }
}
async function openTalk(peerId){
  clearInterval(state.talkTimer);
  state.talkPeer=peerId;
  $("#talkListView").classList.add("hidden");
  $("#talkThreadView").classList.remove("hidden");
  await loadTalkMessages(true);
  state.talkTimer=setInterval(()=>loadTalkMessages(false),3000);
}
async function loadTalkMessages(scroll=true){
  if(!state.talkPeer)return;
  try{
    const d=await api("talk_messages",{peer_id:state.talkPeer});
    $("#talkPeer").innerHTML=`${avatarHTML(d.peer)}<span>${esc(d.peer.display_name)}</span>`;
    $("#talkMessages").innerHTML=d.messages.length?d.messages.map(m=>`
      <div class="talk-bubble-wrap ${m.sender_id===state.me?.id?"me":""}">
        <div class="talk-bubble">${esc(m.body)}<span class="talk-time">${talkTime(m.created_at)}</span></div>
      </div>`).join(""):'<div class="comments-empty">まだメッセージはありません。</div>';
    if(scroll) window.scrollTo(0,document.body.scrollHeight);
    const list=await api("talk_list");
    updateTalkBadge(list.unread_total||0);
  }catch(e){}
}
$("#talkForm").onsubmit=async e=>{
  e.preventDefault();
  const input=$("#talkInput");
  const text=input.value.trim();
  if(!text||!state.talkPeer)return;
  const btn=e.currentTarget.querySelector("button");
  btn.disabled=true;
  try{
    await api("send_message",{peer_id:state.talkPeer,body:text});
    input.value="";
    await loadTalkMessages(true);
  }catch(err){alert(err.message)}
  finally{btn.disabled=false}
};
$("#backTalkList").onclick=async()=>{
  clearInterval(state.talkTimer);
  state.talkTimer=null;
  state.talkPeer=null;
  $("#talkThreadView").classList.add("hidden");
  $("#talkListView").classList.remove("hidden");
  await loadTalkList();
};
$("#newTalkBtn").onclick=async()=>{
  const d=await api("members");
  const people=d.members.filter(m=>m.id!==state.me?.id);
  $("#memberPickerList").innerHTML=people.map(m=>`
    <button class="member-pick-row" data-peer="${m.id}">
      ${avatarHTML(m)}
      <div><strong>${esc(m.display_name)}</strong>${m.bio?`<div class="talk-row-preview">${esc(m.bio)}</div>`:""}</div>
    </button>`).join("");
  $$(".member-pick-row").forEach(b=>b.onclick=()=>{
    $("#memberPickerDialog").close();
    openTalk(b.dataset.peer);
  });
  $("#memberPickerDialog").showModal();
};
$("#closeMemberPicker").onclick=()=>$("#memberPickerDialog").close();

$("#composeFab").onclick=()=>{
  $("#postMsg").textContent="";
  $("#composeDialog").showModal();
  setTimeout(()=>$("#postBody").focus(),80);
};
$("#closeCompose").onclick=()=>$("#composeDialog").close();
$("#composeDialog").addEventListener("click",e=>{
  if(e.target === $("#composeDialog")) $("#composeDialog").close();
});

$("#postImage").onchange=e=>{
  const f=e.target.files[0]; $("#postPreview").innerHTML=f?`<img src="${URL.createObjectURL(f)}" alt="">`:"";
}
$("#submitPost").onclick=async()=>{
  $("#postMsg").textContent="";
  try{
    let imagePath=null; const f=$("#postImage").files[0];
    if(f){$("#postMsg").textContent="画像をアップロード中…";imagePath=(await upload(f,"post")).path}
    await api("create_post",{body:$("#postBody").value,post_type:"normal",image_path:imagePath});
    $("#postBody").value="";$("#postImage").value="";$("#postPreview").innerHTML="";$("#postMsg").textContent="";
    $("#composeDialog").close();
    await go("homePage");
    await loadFeed();
  }catch(e){$("#postMsg").textContent=e.message}
}

async function loadMembers(){
  const d=await api("members"); $("#memberCount").textContent=`${d.members.length}人`;

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

$$(".theme-option").forEach(btn=>{
  btn.onclick=()=>applyTheme(btn.dataset.theme);
});
applyTheme(savedTheme);

$("#logoutBtn").onclick=async()=>{
  try{await call(AUTH_URL,{action:"logout",token:state.token})}catch{}
  localStorage.removeItem("kensho_session");state.token="";state.me=null;showAuth();
}
$("#refreshBtn").onclick=()=>loadFeed();

async function go(id){
  if(id!=="talkPage"){
    clearInterval(state.talkTimer);
    state.talkTimer=null;
  }
  $$(".page").forEach(p=>p.classList.add("hidden"));$("#"+id).classList.remove("hidden");
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
  $("#composeFab").classList.toggle("hidden", id !== "homePage");
  window.scrollTo({top:0,left:0,behavior:"auto"});
  if(id==="talkPage"){
    $("#talkThreadView").classList.add("hidden");
    $("#talkListView").classList.remove("hidden");
    state.talkPeer=null;
    await loadTalkList();
  }
  if(id==="membersPage")await loadMembers();
  if(id==="profilePage")await loadProfile();
}
$$(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.page));

boot();
