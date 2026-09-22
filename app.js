
const SUPABASE_URL = "https://afacytoanuhwedmbfvvf.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_NoaaAtRAVYGe5ObQDE5ByQ_Uw1Dq70F";
const AUTH_URL = `${SUPABASE_URL}/functions/v1/sns-auth`;
const API_URL = `${SUPABASE_URL}/functions/v1/sns-api`;
const GROUP_API_URL = `${SUPABASE_URL}/functions/v1/sns-group`;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const APP_NAME = "ゆでたまSNS";

const savedTheme = localStorage.getItem("yudetama_theme") || "light";
document.body.dataset.activePage="homePage";
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
  talkReplyTo: null,
  talkMessages: [],
  talkSelectedMessage: null,
  talkMuted: false,
  talkTypingTimer: null,
  talkPeerInfo: null,
  talkMode: "direct",
  talkPinnedId: null,
  groupMessages: [],
  talkLoadSeq: 0,
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
async function groupApi(action, extra={}) {
  return call(GROUP_API_URL, { action, token:state.token, ...extra });
}

function isStandaloneWebApp(){return window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator.standalone===true}
function urlBase64ToUint8Array(s){const p="=".repeat((4-s.length%4)%4),b=(s+p).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from([...atob(b)].map(c=>c.charCodeAt(0)))}
async function getPushRegistration(){if(!("serviceWorker" in navigator))return null;try{await navigator.serviceWorker.register("./sw.js?v=45");return await navigator.serviceWorker.ready}catch(e){console.warn("service worker registration failed",e);return null}}
async function updatePushButton(){
  const btn=$("#talkNotificationSetting");
  const icon=$("#talkNotificationIcon");
  const status=$("#talkNotificationStatus");
  if(!btn||!icon||!status)return;

  btn.classList.remove("on","off","blocked","unsupported");

  if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){
    icon.textContent="🔕";
    status.textContent="この端末は非対応";
    btn.classList.add("unsupported");
    btn.setAttribute("aria-label","端末通知：非対応");
    return;
  }
  if(!isStandaloneWebApp()){
    icon.textContent="🔕";
    status.textContent="ホーム画面版で設定";
    btn.classList.add("off");
    btn.setAttribute("aria-label","端末通知：オフ");
    return;
  }
  if(Notification.permission==="denied"){
    icon.textContent="🔕";
    status.textContent="許可されていません";
    btn.classList.add("blocked");
    btn.setAttribute("aria-label","端末通知：許可されていません");
    return;
  }

  const reg=await getPushRegistration();
  const sub=reg?await reg.pushManager.getSubscription():null;

  icon.textContent=sub?"🔔":"🔕";
  status.textContent=sub?"オン":"オフ";
  btn.classList.add(sub?"on":"off");
  btn.setAttribute("aria-label",sub?"端末通知：オン":"端末通知：オフ");
}
async function enablePushNotifications(){if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){alert("この端末ではWeb通知を利用できません。");return}if(!isStandaloneWebApp()){alert("iPhoneではSafariの共有メニューから『ホーム画面に追加』したゆでたまSNSを開いて、もう一度設定してください。");return}if(Notification.permission==="denied"){alert("通知が拒否されています。iPhoneの『設定 → 通知 → ゆでたまSNS』から許可してください。");return}const reg=await getPushRegistration();if(!reg)throw new Error("通知の準備に失敗しました");let sub=await reg.pushManager.getSubscription();if(sub){await api("remove_push_subscription",{endpoint:sub.endpoint});await sub.unsubscribe();await updatePushButton();return}const permission=await Notification.requestPermission();if(permission!=="granted"){await updatePushButton();return}const key=await api("push_public_key");sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key.public_key)});await api("save_push_subscription",{subscription:sub.toJSON(),user_agent:navigator.userAgent});await updatePushButton()}
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

function eggLoadingHTML(label="読み込み中…"){
  return `<div class="talk-egg-loading" aria-label="${esc(label)}">
    <div class="talk-egg-bounce">
      <div class="talk-egg-shadow"></div>
      <div class="talk-egg-body"><div class="talk-egg-yolk"></div></div>
    </div>
    <div class="talk-egg-loading-text">${esc(label)}</div>
  </div>`;
}
function when(iso){const d=new Date(iso);return d.toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}
function initials(name=""){return esc(name.slice(0,1).toUpperCase()||"?")}
const avatarPreloadCache = new Set();
const avatarLoadedCache = new Set();
const stableAvatarUrlCache = new Map();

function stableAvatarUrl(m){
  if(!m?.avatar_url) return "";
  const key=`${m.id||m.display_name||"?"}|${m.avatar_path||"avatar"}`;
  if(!stableAvatarUrlCache.has(key)) stableAvatarUrlCache.set(key,m.avatar_url);
  return stableAvatarUrlCache.get(key);
}
function preloadAvatar(url){
  if(!url || avatarPreloadCache.has(url)) return;
  avatarPreloadCache.add(url);
  const img = new Image();
  img.decoding = "async";
  img.onload=()=>avatarLoadedCache.add(url);
  img.src = url;
}

function avatarHTML(m,size=""){
  const name = m?.display_name || "?";
  const fallback = initials(name);
  const url=stableAvatarUrl(m);
  if(url){
    const loaded=avatarLoadedCache.has(url);
    preloadAvatar(url);
    return `<span class="avatar-shell ${size}">
      <span class="avatar fallback ${size} avatar-placeholder ${loaded?"hidden":""}">${fallback}</span>
      <img class="avatar ${size} avatar-img ${loaded?"loaded":""}" src="${esc(url)}" alt="" loading="eager" decoding="async"
        onload="avatarLoadedCache.add(this.src);this.classList.add('loaded');this.previousElementSibling?.classList.add('hidden')"
        onerror="this.classList.add('hidden')">
    </span>`;
  }
  return `<div class="avatar fallback ${size}">${fallback}</div>`;
}

async function compressAvatarFile(file, maxSize=256, quality=.82){
  if(!file || !file.type?.startsWith("image/")) return file;

  const objectUrl = URL.createObjectURL(file);
  try{
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve,reject)=>{
      img.onload=resolve;
      img.onerror=reject;
      img.src=objectUrl;
    });

    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    if(!sw || !sh) return file;

    const side = Math.min(sw,sh);
    const sx = Math.floor((sw-side)/2);
    const sy = Math.floor((sh-side)/2);

    const canvas = document.createElement("canvas");
    canvas.width=maxSize;
    canvas.height=maxSize;
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    ctx.drawImage(img,sx,sy,side,side,0,0,maxSize,maxSize);

    const blob = await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
    if(!blob) return file;

    const base=(file.name||"avatar").replace(/\.[^.]+$/,"");
    return new File([blob],`${base}.jpg`,{type:"image/jpeg",lastModified:Date.now()});
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
    getPushRegistration().catch(()=>{});
    const talkPeerFromPush=new URLSearchParams(location.search).get("talk");
    if(talkPeerFromPush){history.replaceState(null,"",location.pathname);await go("talkPage");await openTalk(talkPeerFromPush);}
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
  box.innerHTML=eggLoadingHTML();
  try{
    const [d,g]=await Promise.all([
      api("talk_list"),
      groupApi("summary").catch(()=>({last_message:null}))
    ]);
    updateTalkBadge(d.unread_total||0);
    $("#talkUnread").textContent=d.unread_total?`未読 ${d.unread_total}`:"";
    await updatePushButton();

    const groupLast=g.last_message;
    const groupPreview=groupLast
      ? `${groupLast.sender?.display_name?groupLast.sender.display_name+"：":""}${groupLast.body||""}`
      : "全メンバーで話せます";
    const groupTime=groupLast?`<span class="talk-row-time">${talkTime(groupLast.created_at)}</span>`:"";

    const groupRow=`
      <div class="talk-row-wrap group-talk-row-wrap">
        <button class="talk-row group-talk-row" id="openGroupTalk">
          <div class="group-avatar">👥</div>
          <div class="talk-row-main">
            <div class="talk-row-name">全員のトーク</div>
            <div class="talk-row-preview">${esc(groupPreview)}</div>
          </div>
          <div class="talk-row-meta">${groupTime}</div>
        </button>
      </div>`;

    const directRows=d.conversations.length?d.conversations.map(c=>`
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
      </div>`).join(""):"";

    box.innerHTML=groupRow+directRows;
    $("#openGroupTalk").onclick=openGroupTalk;
    $$(".talk-row[data-peer]").forEach(b=>b.onclick=()=>openTalk(b.dataset.peer));
    $$(".talk-delete-btn").forEach(b=>b.onclick=async e=>{
      e.stopPropagation();
      if(!confirm("このトークを一覧から削除しますか？\\n相手側の履歴は削除されません。")) return;
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
  state.talkMode="direct";
  state.talkPeer=peerId;
  state.talkLoadSeq++;
  const mySeq=state.talkLoadSeq;
  $("#talkSettingsBtn").classList.remove("hidden");
  state.talkReplyTo=null;
  $("#replyBar").classList.add("hidden");
  $("#pinnedMessageBar").classList.add("hidden");
  $("#typingIndicator").classList.add("hidden");
  $("#talkMessages").innerHTML=eggLoadingHTML();
  $("#talkPeer").dataset.peerKey="";
  $("#talkPeer").innerHTML=`<div class="talk-peer-placeholder" aria-hidden="true"></div>`;
  $("#talkListView").classList.add("hidden");
  $("#talkThreadView").classList.remove("hidden");
  document.body.classList.add("talk-thread-open");
  updateViewportVars();
  await loadTalkMessages(true, mySeq);
  await pingPresence(false);
  state.talkTimer=setInterval(async()=>{
    const seq=state.talkLoadSeq;
    await loadTalkMessages(false, seq);
    await pingPresence(false);
  },2500);
}


async function openGroupTalk(){
  clearInterval(state.talkTimer);
  state.talkMode="group";
  state.talkPeer="__group__";
  state.talkLoadSeq++;
  state.talkReplyTo=null;
  state.talkPinnedId=null;
  $("#replyBar").classList.add("hidden");
  $("#pinnedMessageBar").classList.add("hidden");
  $("#talkSearchBar").classList.add("hidden");
  $("#talkSettingsBtn").classList.add("hidden");
  $("#talkListView").classList.add("hidden");
  $("#talkThreadView").classList.remove("hidden");
  document.body.classList.add("talk-thread-open");
  $("#talkMessages").innerHTML=eggLoadingHTML();
  $("#talkPeer").dataset.peerKey="";
  $("#talkPeer").innerHTML=`<div class="group-avatar small">👥</div><div><span>全員のトーク</span><small>全メンバー</small></div>`;
  updateViewportVars();
  await loadGroupMessages(true);
  state.talkTimer=setInterval(()=>loadGroupMessages(false),2500);
}

async function loadGroupMessages(forceScroll=false){
  const keepBottom=forceScroll||nearTalkBottom();
  try{
    const d=await groupApi("list");
    state.groupMessages=d.messages||[];
    renderGroupMessages(state.groupMessages);
    if(keepBottom) requestAnimationFrame(()=>scrollTalkToBottom(false));
  }catch(e){}
}

function renderGroupMessages(messages){
  const q=$("#talkSearchInput")?.value.trim().toLowerCase()||"";
  const filtered=q?messages.filter(m=>String(m.body||"").toLowerCase().includes(q)):messages;
  $("#talkMessages").innerHTML=filtered.length?filtered.map(m=>{
    const mine=m.sender_id===state.me?.id;
    const time=talkTime(m.created_at);
    const avatar=!mine?`<div class="talk-side-avatar">${avatarHTML(m.sender,"sm")}</div>`:"";
    return `<div class="talk-bubble-wrap ${mine?"me":""}" data-message="${m.id}">
      ${avatar}
      <div class="message-stack">
        ${!mine?`<div class="group-sender-name">${esc(m.sender?.display_name||"")}</div>`:""}
        <div class="bubble-row ${mine?"me":""}">
          ${mine?`<div class="message-side-meta me"><span class="talk-time-side">${time}</span></div>`:""}
          <div class="talk-bubble"><span class="message-text">${esc(m.body||"")}</span></div>
          ${!mine?`<div class="message-side-meta"><span class="talk-time-side">${time}</span></div>`:""}
        </div>
      </div>
    </div>`;
  }).join(""):'<div class="comments-empty">'+(q?"見つかりませんでした。":"まだメッセージはありません。")+'</div>';
}

function nearTalkBottom(){
  const el=$("#talkMessages");
  if(!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 110;
}

function scrollTalkToBottom(smooth=false){
  const el=$("#talkMessages");
  if(!el) return;
  el.scrollTo({top:el.scrollHeight,behavior:smooth?"smooth":"auto"});
}

function messageBodyText(m){
  return m.deleted_for_all ? "メッセージを削除しました" : m.body;
}

function renderTalkMessages(messages){
  const q=$("#talkSearchInput")?.value.trim().toLowerCase() || "";
  const filtered=q ? messages.filter(m=>messageBodyText(m).toLowerCase().includes(q)) : messages;
  $("#talkMessages").innerHTML=filtered.length?filtered.map(m=>{
    const mine=m.sender_id===state.me?.id;
    const deleted=m.deleted_for_all;
    const reply=m.reply_preview?`<button class="reply-preview" data-jump="${m.reply_preview.id}"><small>${m.reply_preview.sender_id===state.me?.id?"自分":"相手"}</small>${esc(m.reply_preview.body)}</button>`:"";
    const timeOnly=talkTime(m.created_at);
    const readLabel=mine && m.read_at ? `<span class="message-read-side">既読</span>` : `<span class="message-read-side hidden"></span>`;
    const sideAvatar = !mine ? `<div class="talk-side-avatar">${avatarHTML(state.talkPeerInfo,"sm")}</div>` : "";
    return `<div class="talk-bubble-wrap ${mine?"me":""}" data-message="${m.id}">
      ${sideAvatar}
      <div class="message-stack">
        ${reply}
        <div class="bubble-row ${mine?"me":""}">
          ${mine?`<div class="message-side-meta me">${readLabel}<span class="talk-time-side">${timeOnly}</span></div>`:""}
          <div class="talk-bubble ${deleted?"deleted":""}" data-action-message="${m.id}">
            <span class="message-text">${deleted?"メッセージを削除しました":esc(m.body)}</span>
          </div>
          ${!mine?`<div class="message-side-meta">${readLabel}<span class="talk-time-side">${timeOnly}</span></div>`:""}
        </div>
        ${!deleted?`<div class="message-meta ${mine?"me":""}">
          <div class="reaction-summary">${(m.reaction_summary||[]).map(r=>`<button class="reaction-chip ${m.my_reaction===r.emoji?"mine":""}" data-react-chip="${m.id}" data-emoji="${r.emoji}">${r.emoji}${r.count>1?` ${r.count}`:""}</button>`).join("")}</div>
        </div>`:`<div class="message-meta ${mine?"me":""}"><span class="message-meta-spacer"></span></div>`}
      </div>
    </div>`;
  }).join(""):'<div class="comments-empty">'+(q?"見つかりませんでした。":"まだメッセージはありません。")+'</div>';

  $$("[data-react-chip]").forEach(b=>b.onclick=()=>setMessageReaction(b.dataset.reactChip,b.dataset.emoji));
  $$("[data-action-message]").forEach(b=>bindMessagePressActions(b, b.dataset.actionMessage));
  $$(".reply-preview").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    jumpToMessage(b.dataset.jump);
  });
}

async function loadTalkMessages(forceScroll=false, seq=state.talkLoadSeq){
  const peerId=state.talkPeer;
  if(!peerId || state.talkMode!=="direct")return;
  const keepBottom = forceScroll || nearTalkBottom();
  try{
    const d=await api("talk_messages",{peer_id:peerId});
    if(seq!==state.talkLoadSeq || state.talkMode!=="direct" || state.talkPeer!==peerId)return;
    state.talkMessages=d.messages||[];
    state.talkPeerInfo=d.peer || null;
    state.talkMuted=!!d.muted;
    const peerKey=`${d.peer.id}|${d.peer.avatar_path||""}`;
    if($("#talkPeer").dataset.peerKey!==peerKey){
      $("#talkPeer").dataset.peerKey=peerKey;
      $("#talkPeer").innerHTML=`${avatarHTML(d.peer)}<div><span>${esc(d.peer.display_name)}</span><small class="talk-peer-status"></small></div>`;
    }
    const peerStatus=$("#talkPeer .talk-peer-status");
    if(peerStatus) peerStatus.textContent=d.online?"オンライン":"オフライン";
    $("#typingIndicator").classList.toggle("hidden", !d.typing);
    $("#toggleTalkMute").textContent=state.talkMuted?"このトークの通知をオン":"このトークの通知をオフ";
    if(d.pinned){
      $("#pinnedMessageText").textContent=messageBodyText(d.pinned).slice(0,60);
      state.talkPinnedId=d.pinned.id;
      $("#pinnedMessageBar").dataset.messageId=d.pinned.id;
      $("#pinnedMessageBar").classList.remove("hidden");
    }else{
      state.talkPinnedId=null;
      $("#pinnedMessageBar").classList.add("hidden");
      $("#pinnedMessageBar").dataset.messageId="";
    }
    renderTalkMessages(state.talkMessages);
    if(keepBottom) requestAnimationFrame(()=>scrollTalkToBottom(false));
    const list=await api("talk_list");
    if(seq===state.talkLoadSeq) updateTalkBadge(list.unread_total||0);
  }catch(e){
    if(seq===state.talkLoadSeq && state.talkMode==="direct" && state.talkPeer===peerId){
      $("#talkMessages").innerHTML=`<div class="talk-load-error">読み込みに失敗しました<br><small>${esc(e.message||"通信エラー")}</small></div>`;
    }
  }
}

async function setMessageReaction(id, emoji="❤️"){
  try{
    await api("toggle_message_reaction",{message_id:id,emoji});
    await loadTalkMessages(false);
  }catch(e){alert(e.message)}
}
async function toggleMessageLike(id){
  return setMessageReaction(id,"❤️");
}


function bindMessagePressActions(el, id){
  let lastTap = 0;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let swiping = false;

  const wrap = el.closest(".talk-bubble-wrap");

  const resetSwipe = ()=>{
    if(wrap){
      wrap.classList.remove("swiping-reply","reply-ready");
    }
    swiping = false;
  };

  const startGesture = (x, y)=>{
    startX = currentX = x;
    startY = currentY = y;
    swiping = false;
  };

  const moveGesture = (x, y)=>{
    currentX = x;
    currentY = y;
    const dx = x - startX;
    const dy = y - startY;

    // Swipe LEFT to quote-reply. Keep chat itself fixed.
    if(dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.15){
      swiping = true;
      if(wrap){
        wrap.classList.add("swiping-reply");
        wrap.classList.toggle("reply-ready", Math.abs(dx) >= 58);
      }
    }
  };

  const endGesture = ()=>{
    if(swiping){
      const dx = currentX - startX;
      if(dx <= -58){
        const msg = state.talkMessages.find(x=>x.id===id);
        if(msg && !msg.deleted_for_all){
          if(navigator.vibrate) navigator.vibrate(8);
          setReply(msg);
        }
      }
      resetSwipe();
      return;
    }

    const now = Date.now();
    if(now - lastTap < 300){
      lastTap = 0;
      openMessageActions(id);
      if(navigator.vibrate) navigator.vibrate(8);
    }else{
      lastTap = now;
    }
  };

  el.ontouchstart = e=>{
    if(e.touches.length !== 1) return;
    const t = e.touches[0];
    startGesture(t.clientX, t.clientY);
  };
  el.ontouchmove = e=>{
    if(!e.touches.length) return;
    const t = e.touches[0];
    moveGesture(t.clientX, t.clientY);
    if(swiping) e.preventDefault();
  };
  el.ontouchend = ()=>endGesture();
  el.ontouchcancel = ()=>resetSwipe();

  el.onmousedown = e=>{
    if(e.button !== 0) return;
    startGesture(e.clientX, e.clientY);
  };
  el.onmousemove = e=>moveGesture(e.clientX, e.clientY);
  el.onmouseup = ()=>endGesture();
  el.onmouseleave = ()=>resetSwipe();
}
function openMessageActions(id){
  const m=state.talkMessages.find(x=>x.id===id);
  if(!m || m.deleted_for_all) return;
  state.talkSelectedMessage=m;

  const mine=m.sender_id===state.me?.id;

  const dlg=$("#messageActionsDialog");
  const bubble=document.querySelector(`[data-action-message="${id}"]`);
  if(bubble){
    const r=bubble.getBoundingClientRect();
    const vw=window.innerWidth;
    const vh=window.visualViewport?.height || window.innerHeight;
    const menuW=Math.min(300, vw-24);
    const estimatedH=390;
    let left=mine ? Math.min(vw-menuW-12, r.right-menuW) : Math.max(12, r.left);
    left=Math.max(12, Math.min(left, vw-menuW-12));
    let top=r.top-105;
    if(top+estimatedH>vh-12) top=Math.max(12, vh-estimatedH-12);
    if(top<12) top=Math.min(vh-estimatedH-12, r.bottom+8);
    dlg.style.setProperty("--ctx-left",`${Math.max(12,left)}px`);
    dlg.style.setProperty("--ctx-top",`${Math.max(12,top)}px`);
  }
  dlg.showModal();
}

$$("[data-reaction]").forEach(btn=>{
  btn.onclick=async()=>{
    const m=state.talkSelectedMessage;
    if(!m) return;
    const emoji=btn.dataset.reaction;
    $("#messageActionsDialog").close();
    await setMessageReaction(m.id,emoji);
  };
});

function setReply(m){
  state.talkReplyTo=m;
  $("#replyBarText").textContent=messageBodyText(m).slice(0,90);
  $("#replyBar").classList.remove("hidden");
  $("#talkInput").focus();
}
$("#cancelReply").onclick=()=>{state.talkReplyTo=null;$("#replyBar").classList.add("hidden")};

async function copyMessageText(text){
  try{await navigator.clipboard.writeText(text)}
  catch{
    const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
  }
}
$("#actionCopy").onclick=async()=>{const m=state.talkSelectedMessage;if(m)await copyMessageText(messageBodyText(m));$("#messageActionsDialog").close()};
$("#actionPin").onclick=async()=>{const m=state.talkSelectedMessage;if(m){const removing=state.talkPinnedId===m.id;await api("pin_message",{peer_id:state.talkPeer,message_id:removing?"":m.id});}$("#messageActionsDialog").close();await loadTalkMessages(false)};
$("#messageActionsDialog").addEventListener("click",e=>{
  if(e.target===$("#messageActionsDialog")) $("#messageActionsDialog").close();
});

function jumpToMessage(id){
  const el=document.querySelector(`[data-message="${id}"]`);
  if(!el)return;
  el.scrollIntoView({block:"center",behavior:"smooth"});
  el.classList.add("message-highlight");
  setTimeout(()=>el.classList.remove("message-highlight"),900);
}
$("#pinnedMessageBar").onclick=async()=>{
  const id=$("#pinnedMessageBar").dataset.messageId;
  if(!id)return;
  if(confirm("ピン留めを解除しますか？")){
    await api("pin_message",{peer_id:state.talkPeer,message_id:""});
    await loadTalkMessages(false);
  }else{
    jumpToMessage(id);
  }
};

$("#talkSearchBtn").onclick=()=>{$("#talkSearchBar").classList.remove("hidden");$("#talkSearchInput").focus()};
$("#closeTalkSearch").onclick=()=>{$("#talkSearchInput").value="";$("#talkSearchBar").classList.add("hidden");state.talkMode==="group"?renderGroupMessages(state.groupMessages):renderTalkMessages(state.talkMessages)};
$("#talkSearchInput").oninput=()=>state.talkMode==="group"?renderGroupMessages(state.groupMessages):renderTalkMessages(state.talkMessages);

$("#talkNotificationSetting").onclick=async()=>{
  const row=$("#talkNotificationSetting");
  row.disabled=true;
  try{await enablePushNotifications()}
  catch(err){alert(err.message||"通知設定に失敗しました")}
  finally{row.disabled=false;await updatePushButton()}
};

$("#talkSettingsBtn").onclick=()=>$("#talkSettingsDialog").showModal();
$("#closeTalkSettings").onclick=()=>$("#talkSettingsDialog").close();
$("#toggleTalkMute").onclick=async()=>{
  state.talkMuted=!state.talkMuted;
  await api("set_talk_mute",{peer_id:state.talkPeer,muted:state.talkMuted});
  $("#toggleTalkMute").textContent=state.talkMuted?"このトークの通知をオン":"このトークの通知をオフ";
};
$("#deleteTalkFromSettings").onclick=async()=>{
  if(!confirm("このトークを一覧から削除しますか？\n相手側の履歴は削除されません。")) return;
  await api("hide_talk",{peer_id:state.talkPeer});
  $("#talkSettingsDialog").close();
  await closeTalkThread();
};

async function pingPresence(typing=false){
  if(state.talkMode!=="direct"||!state.talkPeer)return;
  try{
    const d=await api("presence",{peer_id:state.talkPeer,typing});
    $("#typingIndicator").classList.toggle("hidden", !d.typing);
  }catch(e){}
}

$("#talkInput").addEventListener("input",()=>{
  if(state.talkMode!=="direct")return;
  clearTimeout(state.talkTypingTimer);
  pingPresence(true);
  state.talkTypingTimer=setTimeout(()=>pingPresence(false),2200);
});

$("#talkForm").onsubmit=async e=>{
  e.preventDefault();
  const input=$("#talkInput");
  const text=input.value.trim();
  if(!text||!state.talkPeer)return;
  const btn=e.currentTarget.querySelector("button");
  btn.disabled=true;
  try{
    if(state.talkMode==="group"){
      await groupApi("send",{body:text});
      input.value="";
      await loadGroupMessages(true);
    }else{
      const replyId=state.talkReplyTo?.id||null;
      await api("send_message",{peer_id:state.talkPeer,body:text,reply_to_id:replyId});
      input.value="";
      state.talkReplyTo=null;
      $("#replyBar").classList.add("hidden");
      await pingPresence(false);
      await loadTalkMessages(true);
    }
    requestAnimationFrame(()=>input.focus({preventScroll:true}));
  }catch(err){alert(err.message)}
  finally{btn.disabled=false}
};

async function closeTalkThread(){
  clearInterval(state.talkTimer);
  state.talkTimer=null;
  clearTimeout(state.talkTypingTimer);
  if(state.talkMode==="direct") await pingPresence(false);
  state.talkLoadSeq++;
  state.talkPeer=null;
  state.talkReplyTo=null;
  state.talkMode="direct";
  state.talkPinnedId=null;
  $("#talkSettingsBtn").classList.remove("hidden");
  document.body.classList.remove("talk-thread-open");
  $("#talkThreadView").classList.add("hidden");
  $("#talkListView").classList.remove("hidden");
  await loadTalkList();
}
$("#backTalkList").onclick=closeTalkThread;

function updateViewportVars(){
  const vv=window.visualViewport;
  const h=vv?vv.height:window.innerHeight;
  const top=vv?vv.offsetTop:0;
  document.documentElement.style.setProperty("--vvh",`${h}px`);
  document.documentElement.style.setProperty("--vvtop",`${top}px`);
}
if(window.visualViewport){
  visualViewport.addEventListener("resize",()=>{
    const inputFocused=document.activeElement===$("#talkInput");
    const wasNear=nearTalkBottom();
    updateViewportVars();
    if(inputFocused&&wasNear) requestAnimationFrame(()=>scrollTalkToBottom(false));
  });
  visualViewport.addEventListener("scroll",updateViewportVars);
}
window.addEventListener("resize",updateViewportVars);
updateViewportVars();
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
  if(m.avatar_url){preloadAvatar(m.avatar_url);$("#profileAvatar").decoding="async";$("#profileAvatar").src=m.avatar_url;$("#profileAvatar").classList.remove("hidden");$("#profileFallback").classList.add("hidden")}
  else{$("#profileAvatar").classList.add("hidden");$("#profileFallback").classList.remove("hidden");$("#profileFallback").textContent=(m.display_name||"?").slice(0,1)}
}
$("#avatarInput").onchange=async e=>{
  const f=e.target.files[0];
  if(!f)return;
  $("#profileMsg").textContent="画像を最適化中…";
  try{
    const optimized=await compressAvatarFile(f,256,.82);
    $("#profileMsg").textContent="アップロード中…";
    await upload(optimized,"avatar");
    $("#profileMsg").textContent="アイコンを変更しました";
    await loadProfile();
  }catch(err){
    $("#profileMsg").textContent=err.message;
  }finally{
    e.target.value="";
  }
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
async function go(id){
  document.body.dataset.activePage=id;
  if(id!=="talkPage"){
    clearInterval(state.talkTimer);
    state.talkTimer=null;
    document.body.classList.remove("talk-thread-open");
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


/* Pull to refresh on Home */
let pullStartY = 0;
let pullDistance = 0;
let pulling = false;
let pullRefreshing = false;

function resetPullRefresh(){
  const el = $("#pullRefresh");
  if(!el) return;
  pullDistance = 0;
  pulling = false;
  el.classList.remove("ready","refreshing");
  el.style.transform = "translateY(-54px)";
  const icon = el.querySelector(".pull-refresh-icon");
  const text = el.querySelector(".pull-refresh-text");
  if(icon) icon.textContent = "↓";
  if(text) text.textContent = "下に引っ張って更新";
}

const homePage = $("#homePage");
if(homePage){
  homePage.addEventListener("touchstart", e=>{
    if(pullRefreshing) return;
    if(window.scrollY <= 0 && e.touches.length === 1){
      pullStartY = e.touches[0].clientY;
      pullDistance = 0;
      pulling = true;
    }
  }, {passive:true});

  homePage.addEventListener("touchmove", e=>{
    if(!pulling || pullRefreshing) return;
    const dy = e.touches[0].clientY - pullStartY;
    if(dy <= 0){
      pullDistance = 0;
      return;
    }
    pullDistance = Math.min(90, dy * 0.55);
    const el = $("#pullRefresh");
    if(!el) return;
    el.style.transform = `translateY(${pullDistance - 54}px)`;
    const ready = pullDistance >= 58;
    el.classList.toggle("ready", ready);
    const icon = el.querySelector(".pull-refresh-icon");
    const text = el.querySelector(".pull-refresh-text");
    if(icon) icon.textContent = ready ? "↑" : "↓";
    if(text) text.textContent = ready ? "離すと更新" : "下に引っ張って更新";
  }, {passive:true});

  homePage.addEventListener("touchend", async ()=>{
    if(!pulling || pullRefreshing) return;
    const shouldRefresh = pullDistance >= 58;
    pulling = false;

    if(!shouldRefresh){
      resetPullRefresh();
      return;
    }

    pullRefreshing = true;
    const el = $("#pullRefresh");
    const icon = el?.querySelector(".pull-refresh-icon");
    const text = el?.querySelector(".pull-refresh-text");
    el?.classList.add("refreshing");
    if(el) el.style.transform = "translateY(0)";
    if(icon) icon.textContent = "↻";
    if(text) text.textContent = "更新中…";

    try{
      await loadFeed();
      if(icon) icon.textContent = "✓";
      if(text) text.textContent = "更新しました";
      await new Promise(r=>setTimeout(r,450));
    }finally{
      pullRefreshing = false;
      resetPullRefresh();
    }
  }, {passive:true});
}

boot();


/* suppress iPhone native copy/select popups in talk messages */
function clearTalkSelectionIfNeeded(){
  const sel = window.getSelection ? window.getSelection() : null;
  if(!sel || !sel.rangeCount) return;
  const anchorNode = sel.anchorNode;
  const el = anchorNode && anchorNode.parentElement ? anchorNode.parentElement : null;
  if(document.body.classList.contains("talk-thread-open") && el && el.closest && el.closest("#talkMessages")){
    try{ sel.removeAllRanges(); }catch(e){}
  }
}
document.addEventListener("contextmenu", e=>{
  if(document.body.classList.contains("talk-thread-open") && e.target.closest && e.target.closest("#talkMessages")){
    e.preventDefault();
  }
}, {capture:true});

document.addEventListener("selectstart", e=>{
  if(document.body.classList.contains("talk-thread-open") && e.target.closest && e.target.closest("#talkMessages")){
    e.preventDefault();
  }
}, {capture:true});

document.addEventListener("selectionchange", ()=>{
  clearTalkSelectionIfNeeded();
}, {capture:true});

