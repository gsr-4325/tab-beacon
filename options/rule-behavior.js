(()=>{
const STORAGE_KEY="tabBeaconRules";
const t=(key,fallback)=>chrome.i18n?.getMessage?.(key)||fallback||key;
const normalizeBusyEndGraceMs=(value,fallbackMs=10_000)=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(300_000,Math.round(n))):fallbackMs;};
const formatBusyEndGraceSeconds=(value)=>String(Number((normalizeBusyEndGraceMs(value)/1000).toFixed(2)));
const parseBusyEndGraceSeconds=(value)=>{const n=Number.parseFloat(String(value||"").trim());return Number.isFinite(n)?normalizeBusyEndGraceMs(n*1000):10_000;};
const behaviorMarkup=()=>`<section class="behavior-panel"><div class="section-header"><h3>${t("behaviorTitle","Behavior")}</h3></div><div class="row behavior-row"><label class="behavior-grace-field"><span>${t("busyEndGracePeriod","Busy end grace period")}</span><div class="inline-input"><input type="number" min="0" max="60" step="0.5" class="rule-busy-end-grace-seconds" /><span class="hint">${t("secondsUnit","seconds")}</span></div></label></div><p class="hint">${t("busyEndGraceHint","Keep the busy indicator for a short time after all conditions become false.")}</p></section>`;
function patchStyles(){if(document.getElementById("tabBeaconRuleBehaviorStyle"))return;const style=document.createElement("style");style.id="tabBeaconRuleBehaviorStyle";style.textContent=`.behavior-panel{padding:14px;background:var(--conditions-surface);border:1px solid var(--panel-border);border-radius:16px;display:grid;gap:12px}.readonly-rule .behavior-panel{background:var(--system-conditions-surface);border-color:rgba(95,108,133,.28)}.behavior-row{justify-content:flex-start;align-items:flex-end}.behavior-grace-field{max-width:240px}.inline-input{display:inline-flex;align-items:center;gap:10px}.inline-input input{width:120px}`;document.head.appendChild(style);}
function ensureBehaviorSection(root,rule){const conditionsPanel=root.querySelector(".conditions-panel");if(!conditionsPanel)return;let panel=root.querySelector(".behavior-panel");if(!panel){conditionsPanel.insertAdjacentHTML("beforebegin",behaviorMarkup());panel=root.querySelector(".behavior-panel");}const input=panel.querySelector(".rule-busy-end-grace-seconds");input.value=formatBusyEndGraceSeconds(rule?.busyEndGraceMs);if(root.dataset.readonly==="true")input.disabled=true;}
function patchGlobals(){
const originalNormalizeRuleForEditor=normalizeRuleForEditor;
normalizeRuleForEditor=function(rule){const normalized=originalNormalizeRuleForEditor(rule);normalized.busyEndGraceMs=normalizeBusyEndGraceMs(rule?.busyEndGraceMs);return normalized;};
const originalCreateEmptyRule=createEmptyRule;
createEmptyRule=function(){const rule=originalCreateEmptyRule();rule.busyEndGraceMs=10_000;return rule;};
const originalBuildDefaultRules=buildDefaultRules;
buildDefaultRules=function(){return originalBuildDefaultRules().map((rule)=>({...rule,busyEndGraceMs:normalizeBusyEndGraceMs(rule.busyEndGraceMs)}));};
if(typeof DEBUG_LOCAL_SANDBOX_PRESET==="object"&&DEBUG_LOCAL_SANDBOX_PRESET)DEBUG_LOCAL_SANDBOX_PRESET.busyEndGraceMs=normalizeBusyEndGraceMs(DEBUG_LOCAL_SANDBOX_PRESET.busyEndGraceMs);
const originalCreateRuleNode=createRuleNode;
createRuleNode=function(rule,options){const node=originalCreateRuleNode(rule,options);ensureBehaviorSection(node,rule);return node;};
const originalDisableRuleEditing=disableRuleEditing;
disableRuleEditing=function(root,options){originalDisableRuleEditing(root,options);root.querySelector(".rule-busy-end-grace-seconds")?.setAttribute("disabled","disabled");};
const originalCollectRulesFromDom=collectRulesFromDom;
collectRulesFromDom=function(){const rules=originalCollectRulesFromDom();const roots=Array.from(document.querySelectorAll(".rule"));return rules.map((rule,index)=>({...rule,busyEndGraceMs:parseBusyEndGraceSeconds(roots[index]?.querySelector(".rule-busy-end-grace-seconds")?.value)}));};
}
async function rerenderFromStorage(){const result=await chrome.storage.local.get(STORAGE_KEY);let rules=Array.isArray(result[STORAGE_KEY])&&result[STORAGE_KEY].length?result[STORAGE_KEY]:buildDefaultRules();let changed=false;rules=rules.map((rule)=>{const busyEndGraceMs=normalizeBusyEndGraceMs(rule?.busyEndGraceMs);if(rule?.busyEndGraceMs===busyEndGraceMs)return rule;changed=true;return{...rule,busyEndGraceMs};});if(changed)await chrome.storage.local.set({[STORAGE_KEY]:rules});renderRules(rules.map(normalizeRuleForEditor));markClean?.();}
function ready(){return typeof renderRules==="function"&&typeof normalizeRuleForEditor==="function"&&typeof createRuleNode==="function"&&document.getElementById("rulesContainer");}
async function init(){patchStyles();if(!ready()){setTimeout(init,30);return;}patchGlobals();await rerenderFromStorage();}
init().catch((error)=>console.error("[TabBeacon] rule behavior patch failed",error));
})();
