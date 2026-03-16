const defaultPromptData = {
    chars: [
        {
            id: 'cyber-girl',
            title: '👨‍🎤 赛博朋克女孩 (Cyber Girl)',
            items: [
                { id: 'cg-1', name: '标准战斗服', prompt: '1girl, solo, cyberpunk style, neon lights, black combat suit, glowing visor, high detail, masterpiece' },
                { id: 'cg-2', name: '休闲夹克装', prompt: '1girl, solo, cyberpunk style, daylight, wearing oversized yellow jacket, crop top, streetwear, high resolution' }
            ]
        },
        {
            id: 'fantasy-mage',
            title: '🧙‍♂️ 奇幻法师 (Fantasy Mage)',
            items: [
                { id: 'fm-1', name: '星空长袍', prompt: '1boy, male mage, long wizard robe with starry patterns, holding glowing staff, casting spell, fantasy illustration' },
                { id: 'fm-2', name: '旅行斗篷', prompt: '1boy, male traveler, ragged cloak, holding old book, walking in forest, dynamic lighting, 8k' }
            ]
        }
    ],
    actions: [
        {
            id: 'action-basic',
            title: '🏃‍♂️ 动态与姿势',
            items: [
                { id: 'ab-1', name: '拔剑姿势', prompt: 'dynamic pose, drawing sword, leaning forward, looking at viewer, intense action' },
                { id: 'ab-2', name: '漂浮半空', prompt: 'floating in the air, weightless, zero gravity, hair blowing in the wind, magical pose' },
                { id: 'ab-3', name: '回眸一笑', prompt: 'looking back over shoulder, gentle smile, eye contact, cinematic angle' }
            ]
        }
    ],
    env: [
        {
            id: 'env-light',
            title: '🌄 环境与光影',
            items: [
                { id: 'el-1', name: '废弃城市落日', prompt: 'ruined city, overgrown with plants, sunset, golden hour, god rays, atmospheric lighting' },
                { id: 'el-2', name: '魔法森林起雾', prompt: 'magical forest, glowing mushrooms, dense fog, mystical atmosphere, fireflies' }
            ]
        },
        {
            id: 'env-quality',
            title: '💎 画质提升词',
            items: [
                { id: 'eq-1', name: '通用高画质', prompt: 'masterpiece, best quality, ultra-detailed, 8k resolution, finely detailed, photorealistic' },
                { id: 'eq-2', name: '二次元质感', prompt: 'anime visual novel style, studio ghibli, vivid colors, clear lines, high contrast' }
            ]
        }
    ],
    outfit: [
        {
            id: 'outfit-street-tech',
            title: '🧥 街头机能风',
            tops: [
                { id: 'ot-st-1', name: '机能短夹克', prompt: 'techwear cropped jacket, functional pockets, nylon texture, matte black, detailed seams' }
            ],
            bottoms: [
                { id: 'ob-st-1', name: '束脚工装裤', prompt: 'cargo jogger pants, tactical straps, layered panels, urban techwear style' }
            ],
            shoes: [
                { id: 'os-st-1', name: '厚底机能鞋', prompt: 'chunky tech sneakers, high-top silhouette, monochrome design, streetwear fashion' }
            ],
            headwear: [],
            accessories: [],
            weapons: [],
            others: []
        }
    ]
};

const TAB_KEYS = ['chars', 'actions', 'env', 'outfit'];
const OUTFIT_CATEGORY_KEYS = ['tops', 'bottoms', 'shoes', 'headwear', 'accessories', 'weapons', 'others'];
const OUTFIT_CATEGORY_LABELS = {
    tops: '上衣',
    bottoms: '下装',
    shoes: '鞋子',
    headwear: '头饰',
    accessories: '配件',
    weapons: '武器',
    others: '其他'
};

let promptData = JSON.parse(JSON.stringify(defaultPromptData));
let activeTab = 'chars';
let editState = null;
let addState = null;
let activeCharGroupMenuId = null;
let activeCharTagEditor = null;
let activeCharTags = [];
let activeCharTagMode = 'or';
let activeCharKeyword = '';
let activeOutfitCategory = '__all__';
let isReadOnlyMode = false;
let isAdminUser = false;
let currentUserId = '';
let currentUsername = '';
let currentNickname = '';
let toastTimeout;

const charGroupTitleInput = document.getElementById('char-group-title-input');
const charGroupAddBtn = document.getElementById('char-group-add-btn');
const outfitGroupTitleInput = document.getElementById('outfit-group-title-input');
const outfitGroupAddBtn = document.getElementById('outfit-group-add-btn');
const outfitCategoryFilters = document.getElementById('outfit-category-filters');
const charTagFilters = document.getElementById('char-tag-filters');
const charNameSearch = document.getElementById('char-name-search');
const charNameSearchClear = document.getElementById('char-name-search-clear');
