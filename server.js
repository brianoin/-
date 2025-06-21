const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const app = express();
const port = 5000;

// 解析 JSON 格式的請求體
app.use(express.json());

// 提供靜態檔案
app.use(express.static(path.join(__dirname)));

// 會員驗證中間件
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: '未登入' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: '未登入' });
    }

    // 檢查 token 是否有效
    db.get('SELECT * FROM users WHERE token = ?', [token], (err, user) => {
        if (err) {
            return res.status(500).json({ message: '資料庫錯誤' });
        }
        if (!user) {
            return res.status(401).json({ message: '未登入' });
        }
        req.user = user;
        next();
    });
};

// 初始化 SQLite 資料庫
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('資料庫連線錯誤:', err.message);
    } else {
        console.log('成功連線到 SQLite 資料庫');
        
        // 先刪除舊的 users 表格
        db.run('DROP TABLE IF EXISTS users', (err) => {
            if (err) {
                console.error('刪除舊表格錯誤:', err.message);
            } else {
                console.log('舊表格已刪除');
                
                // 建立新的使用者表格
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    token TEXT
                )`, (err) => {
                    if (err) {
                        console.error('建立使用者表格錯誤:', err.message);
                    } else {
                        console.log('使用者表格已準備好');
                    }
                });
            }
        });

        // 建立系統參數資料表
        db.run(`CREATE TABLE IF NOT EXISTS sys_parainfo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            param_code VARCHAR(50) NOT NULL,
            param_value VARCHAR(255) NOT NULL,
            param_desc VARCHAR(255),
            sys_flag CHAR(1) NOT NULL DEFAULT 'N'
        )`, (err) => {
            if (err) {
                console.error('建立系統參數表格錯誤:', err.message);
            } else {
                console.log('系統參數表格已準備好');
            }
        });

        // 建立系統功能資料表
        db.run(`CREATE TABLE IF NOT EXISTS sys_menuinfo (
            menuid INTEGER PRIMARY KEY AUTOINCREMENT,
            paretid INTEGER DEFAULT 0,
            menuna NVARCHAR(255) NOT NULL,
            menuimg VARCHAR(255) DEFAULT '',
            menuurl VARCHAR(255) DEFAULT '',
            menonly CHAR(1) DEFAULT 'Y',
            opennew CHAR(1) DEFAULT 'N',
            dispseq CHAR(10) DEFAULT '00100',
            lastusr INTEGER DEFAULT 0,
            lasttm CHAR(14) DEFAULT ''
        )`, (err) => {
            if (err) {
                console.error('建立系統功能表格錯誤:', err.message);
            } else {
                console.log('系統功能表格已準備好');
                // 檢查並新增測驗選單
                db.get('SELECT * FROM sys_menuinfo WHERE menuurl = ?', ['/quiz'], (err, row) => {
                    if (!err && !row) {
                        db.run(`INSERT INTO sys_menuinfo (menuna, menuurl, dispseq) VALUES (?, ?, ?)`,
                            ['線上測驗', '/quiz', '00200'],
                            (err) => {
                                if (err) {
                                    console.error('插入測驗選單項目錯誤:', err.message);
                                } else {
                                    console.log('已新增線上測驗至選單');
                                }
                            }
                        );
                    }
                });
            }
        });

        // 建立測驗資料表
        db.run(`CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_answer CHAR(1) NOT NULL
        )`, (err) => {
            if (err) {
                console.error('建立測驗表格錯誤:', err.message);
            } else {
                console.log('測驗表格已準備好');
                // 清空舊題目並重設 ID，然後插入新題目
                db.serialize(() => {
                    db.run('DELETE FROM quizzes', (err) => {
                        if (err) return console.error('清空測驗表格錯誤:', err.message);
                    });
                    db.run("DELETE FROM sqlite_sequence WHERE name='quizzes'", (err) => {
                        // This might fail if the table was just created, which is fine.
                    });

                    // 插入新的測驗題目
                    const stmt = db.prepare('INSERT INTO quizzes (question, option_a, option_b, option_c, option_d, correct_answer) VALUES (?, ?, ?, ?, ?, ?)');
                    const quizzes = [
                        ["心肌的肌內質網主要受何者刺激而釋放鈣離子？", "細胞外流入的鈉離子", "肌醇三磷酸", "細胞外流入的鈣離子", "細胞膜電位的改變", "C"],
                        ["下列何種疾病與耳朵功能異常最無關？", "黃斑退化症（macular degeneration）", "梅尼爾氏症（Meniere's disease）", "良性陣發性姿勢型暈眩（benign paroxysmal positional vertigo）", "動暈症（motion sickness）", "A"],
                        ["下列何者會導致電位過極化（hyperpolarizing），進而誘發抑制性突觸後電位（inhibitory postsynaptic potential, IPSP）的表現？", "Cl- channel open；K+ channel open", "Na+ channel open；K+ channel open", "Ca2+ channel open；K+ channel open", "Na+ channel open；Cl- channel open", "A"],
                        ["下列有關褪黑激素（melatonin）的敘述，何者錯誤？", "可由松果腺（pineal gland）分泌", "血清素（serotonin）為其前驅物", "夜晚睡眠時體內之濃度最低", "可治療時差所造成的不適", "C"],
                        ["在人類胚胎期，下列何種激素最可能直接刺激外生殖構造發育為男性？", "睪固酮（testosterone）", "雙氫睪固酮（DHT）", "雌激素（estrogen）", "去氫雄脂酮（DHEA）", "B"],
                        ["特定微血管區段之微血管靜水壓（capillary hydrostatic pressure）為24 mmHg、組織間隙靜水壓（interstitial hydrostatic pressure）為0 mmHg、微血管滲透壓（capillary colloid osmotic pressure）為12 mmHg、組織間隙滲透壓（interstitial colloid osmotic pressure）為2 mmHg，則該處微血管液流動形式及總驅動力（net filtration pressure）分別為何？", "再吸收（absorption）流入微血管：7 mmHg", "再吸收（absorption）流入微血管：14 mmHg", "過濾（filtration）流出微血管：7 mmHg", "過濾（filtration）流出微血管：14 mmHg", "D"],
                        ["在胎兒時期，下列那個構造可與右心房直接相通？", "動脈導管", "肺動脈幹", "左心房", "左心室", "C"],
                        ["正常情況下，下列何種物質在腎臟再吸收（reabsorption）的比例最高？", "水", "鈉離子", "葡萄糖", "尿素", "C"],
                        ["肺氣腫（emphysema）患者因肺泡壁遭到破壞而容易出現下列那一種變化？", "肺泡氣體擴散的總面積增加", "肺臟回彈力增加", "肺臟順應性增加", "呼吸道阻力降低", "C"],
                        ["有關輔脂解酶（colipase）的敘述，下列何者正確？", "由胰臟分泌", "由肝臟分泌", "僅具脂溶性", "具脂解的作用", "A"],
                        ["下列那兩個體內空腔之間沒有實質構造區隔，其中一個空腔內如果產生積水，會在兩個空腔內互通？", "縱膈腔（mediastinum）與胸膜腔（pleural cavity）", "胸膜腔（pleural cavity）與心包腔（pericardial cavity）", "心包腔（pericardial cavity）與腹腔（abdominal cavity）", "腹腔（abdominal cavity）與骨盆腔（pelvic cavity）", "D"],
                        ["關於腦下垂體（pituitary gland）的描述，下列何者錯誤？", "與下視丘（hypothalamus）相連", "位於蝶鞍的腦下垂體窩", "腦下垂體中間部分泌黑色素細胞刺激素（melanocyte-stimulating hormone）", "腦下垂體中間部分泌褪黑素（melatonin）", "D"],
                        ["下列有關成人腰椎（lumbar vertebrae）的敘述，何者正確？", "典型腰椎棘突（spinous process）細長，朝下延伸", "典型腰椎橫突（transverse process）具孔洞，供神經穿行", "腰椎曲（lumbar curvature）是往前拱起的彎曲", "腰椎穿刺（lumbar puncture）一般是在第一、二腰椎之間進行", "C"],
                        ["下列何者屬於彈性動脈？", "腎動脈（renal artery）", "脾動脈（splenic artery）", "股動脈（femoral artery）", "主動脈（aorta）", "D"],
                        ["下列何者不是輸尿管（ureter）管腔較為狹窄的位置？", "腎盂（renal pelvis）與輸尿管交接處", "腰大肌（psoas major）表面", "髂總動脈（common iliac artery）分叉為髂內及髂外動脈處", "穿進膀胱（urinary bladder）處", "B"],
                        ["下列何者不具支撐子宮（uterus）的功能？", "主韌帶（cardinal ligament）", "懸韌帶（suspensory ligament）", "骨盆膈（pelvic diaphragm）", "泌尿生殖膈（urogenital diaphragm）", "B"],
                        ["下列何者為負責分泌胃酸的細胞？", "主細胞（chief cell）", "壁細胞（parietal cell）", "黏液頸細胞（mucous neck cell）", "腸內分泌細胞（enteroendocrine cell）", "B"],
                        ["耳下腺導管（parotid duct）開口於口腔何處的黏膜？", "上列第一臼齒", "上列第二臼齒", "上列第三臼齒", "下列第二臼齒", "B"],
                        ["當肱骨（humerus）的骨幹發生骨折，最可能直接傷及那一條手臂的神經？", "肌皮神經（musculocutaneous nerve）", "正中神經（median nerve）", "尺神經（ulnar nerve）", "橈神經（radial nerve）", "D"],
                        ["下列何者源自骨髓細胞，而後遷移至中樞神經系統內成熟？", "星狀細胞（astrocytes）", "寡樹突膠細胞（oligodendrocytes）", "微膠細胞（microglia）", "室管膜細胞（ependymal cells）", "C"],
                        ["有關急性發炎反應（acute inflammation）的敘述，下列何者正確？", "參與的白血球主要是嗜酸性白血球（eosinophils）", "組織間隙常因血管通透性增加所以有漏出液（transudate）的蓄積", "受損組織細胞分泌的緩激肽（bradykinin）與痛覺產生有關", "介白素-1（interleukin-1）是造成血管舒張主要的媒介物", "C"],
                        ["下列何者與血液的高凝血狀態易形成血栓的關聯性最小？", "長期臥床", "口服避孕藥之使用", "抗磷脂質症候群", "von Willebrand疾病", "D"],
                        ["KIT 基因突變是下列那種腫瘤最常見的分子變化？", "肺腺癌", "胃腸道基質瘤", "肝癌", "膀胱癌", "B"],
                        ["下列何者並非鉛中毒的常見表現？", "肝硬化", "兒童智力發展障礙", "周邊神經病變", "貧血", "A"],
                        ["下列何種血管炎會造成主動脈（aorta）及其主要分支的發炎狹窄，可能導致上肢摸不到脈搏，因而又稱為無脈症（pulseless disease）？", "高安氏動脈炎（Takayasu arteritis）", "川崎氏病（Kawasaki disease）", "韋格納氏肉芽腫（Wegener granulomatosis）", "伯格氏病（Buerger disease）", "A"],
                        ["下列何者是何杰金氏淋巴瘤（Hodgkin lymphoma）的腫瘤細胞？", "淋巴母細胞（lymphoblast）", "副免疫母細胞（paraimmunoblast）", "瑞德－史登堡氏細胞（Reed-Sternberg cell）", "卡哈爾－瑞齊烏斯氏細胞（Cajal-Retzius cell）", "C"],
                        ["有關家族性腺瘤性息肉症（familial adenomatous polyposis），下列敘述何者錯誤？", "是體染色體隱性（autosomal recessive）遺傳", "病人的大腸會有超過100個腺瘤性息肉", "未治療的病人幾乎都會發生大腸癌", "可以用預防性大腸切除術來治療", "A"],
                        ["下列何者為快速進行性腎絲球腎炎（rapidly progressive glomerulonephritis）最主要的病理變化？", "新月體（crescent）", "乾酪性壞死（caseous necrosis）", "羅素小體（Russell body）", "類纖維素性壞死（fibrinoid necrosis）", "A"],
                        ["乳癌病患出現橘皮（peau d'orange）現象，與下列何者最有關？", "不典型乳管增生（atypical ductal hyperplasia）", "發炎性癌 （inflammatory carcinoma）", "BRCA1 基因突變", "乳管擴張", "B"],
                        ["庫賈氏病（Creutzfeldt-Jakob disease）最典型的病理變化為下列何者？", "脫髓鞘斑塊", "腦膿瘍", "中腦黑質退化", "大腦海綿狀轉化", "D"],
                        ["下列何種藥物不能抑制乙醯膽鹼酯酶（acetylcholinesterase）？", "physostigmine", "sarin", "edrophonium", "bethanechol", "D"],
                        ["下列藥物中，何者對於改善酒精成癮治療沒有幫助？", "naltrexone", "acamprosate", "acetaminophen", "disulfiram", "C"],
                        ["使用局部麻醉劑時常與腎上腺素合用，其目的為何？", "使局部血管收縮", "增加局部麻醉劑的吸收", "增強中樞正腎上腺素系統之止痛作用", "減少局部過敏", "A"],
                        ["下列何種藥物可調節血清素（serotonin）神經傳遞系統，達到抗憂鬱效果？", "ergonovine", "fluoxetine", "ondansetron", "sumatriptan", "B"],
                        ["毛地黃中毒時，因心跳過慢導致心律不整，下列何者為正確且安全的治療策略?", "直接給與高劑量鎂與毛地黃競爭Na+-K+pump 的結合位", "血鉀過低時宜補充鉀，並以atropine治療房室阻斷", "可以抗心律不整藥物amiodarone來治療", "不宜給與毛地黃抗體，以免加重傳導阻斷", "B"],
                        ["Abciximab治療不穩定型心絞痛（unstable angina）的藥理機制為何？", "cyclic nucleotide phosphodiesterase抑制劑", "GP IIb/IIIa 抑制劑", "cyclooxygenase I 抑制劑", "P2Y12 ADP receptor 拮抗劑", "B"],
                        ["下列何種藥物最適合以吸入方式用於緩解急性氣喘（asthma）發作？", "albuterol", "salmeterol", "beclomethasone", "mometasone", "A"],
                        ["下列那一個藥物最適合用來治療變形性骨炎（Paget disease）？", "zoledronic acid", "denosumab", "teriparatide", "romosozumab", "A"],
                        ["下列有關doxorubicin的描述，何者錯誤？", "可治療急性淋巴球性白血病", "可治療肉瘤", "具有劑量依賴性的心臟毒性", "可抑制topoisomerase I 活性", "D"],
                        ["使用化學治療藥於癌症病患，有時會給與amifostine，試問amifostine有何藥理作用？", "保護正常細胞組織，避免細胞損傷", "增強抗癌藥穿透血腦障壁，進入中樞神經系統", "減少腫瘤組織周邊血液的asparagine含量", "增強病人的免疫系統功能", "A"],
                        ["細菌間遺傳物質移轉有不同方式，其中噬菌體（phage）是藉由下列何種方式進行？", "接合作用（conjugation）", "轉化作用（transformation）", "導入作用（transduction）", "分泌作用（secretion）", "C"],
                        ["有關嗜中性白血球的敘述，下列何者錯誤？", "屬於後天性免疫細胞", "產生氧化活性物質能殺死病菌", "具有吞噬微生物的能力", "可藉由特殊的死亡方式釋放網狀結構捕捉微生物", "A"],
                        ["下列何者為T細胞最初發育的器官？", "淋巴結", "脾臟", "胸腺", "肝臟", "C"],
                        ["下列何者屬於減毒之活病毒疫苗？", "B型肝炎疫苗", "狂犬病疫苗", "破傷風疫苗", "小兒麻痺沙賓疫苗", "D"],
                        ["有關金黃色葡萄球菌（Staphylococcus aureus）感染所造成的臨床表徵，下列何者症狀通常不是由其分泌的毒素所導致？", "猛爆性紫斑病（purpura fulminans）", "葡萄球菌食物中毒（food poisoning）", "心內膜炎（endocarditis）", "葡萄球菌燙傷狀皮膚症候群（staphylococcal scalded skin syndrome）", "C"],
                        ["病人最近得到泌尿道感染，醫師利用革蘭氏染色法檢驗尿液中的細菌，染到與番紅（safranin）呈現相同顏色的一株細菌，下列針對這株細菌的敘述，何者錯誤？", "可能是大腸桿菌（E. coli）", "可能會產生內孢子（endospore）", "應該具有內毒素（endotoxin）", "可能缺少壁脂酸（lipoteichoic acid）的結構", "B"],
                        ["有關花斑癬（Pityriasis versicolor）之敘述，下列何者正確？", "其病原菌馬拉色氏菌（Malassezia）平常不會在健康人皮膚上", "是一種嗜脂性黴菌", "不會形成菌絲", "為造成血液感染主要的病原真菌", "B"],
                        ["有關腺病毒（adenovirus）的敘述，下列何者錯誤？", "腺病毒感染會造成結膜炎、呼吸道感染或腸胃炎", "腺病毒的感染以大人居多，小孩感染的病例較少", "腺病毒的基因體是DNA", "腺病毒目前並無特定抗病毒藥物可以治療", "B"],
                        ["下列何種RNA病毒沒有上市的疫苗可預防其感染？", "輪狀病毒", "小兒麻痺病毒", "麻疹病毒", "C型肝炎病毒", "D"],
                        ["下列何種症狀最常出現於非洲錐蟲病（African trypanosomiasis）病人的急性期臨床表現？", "昏迷和抽搐", "高燒和昏睡", "無法集中注意力和失去平衡", "發熱、肌肉疼痛、關節疼痛和淋巴結腫大", "D"]
                    ];
                    
                    quizzes.forEach(quiz => {
                        stmt.run(quiz, (err) => {
                            if (err) return console.error('插入題目錯誤:', err.message, '題目:', quiz[0]);
                        });
                    });

                    stmt.finalize((err) => {
                        if (err) {
                            console.error('完成插入測驗題目時出錯:', err.message);
                        } else {
                            console.log('已成功插入50條新的測驗題目');
                        }
                    });
                });
            }
        });
    }
});

// 註冊 API
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '帳號和密碼不能為空' });
    }

    try {
        // 檢查使用者是否已存在
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (row) {
                return res.status(409).json({ message: '此帳號已存在' });
            }

            // 加密密碼
            const hashedPassword = await bcrypt.hash(password, 10);

            // 儲存使用者
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }
                res.status(201).json({ message: '註冊成功！', userId: this.lastID });
            });
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 登入 API
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '帳號和密碼不能為空' });
    }

    try {
        // 查找使用者
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!user) {
                return res.status(401).json({ message: '帳號或密碼錯誤' });
            }

            // 比較密碼
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                // 生成 token
                const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
                
                // 更新使用者的 token
                db.run('UPDATE users SET token = ? WHERE id = ?', [token, user.id], (err) => {
                    if (err) {
                        return res.status(500).json({ message: err.message });
                    }
                    res.status(200).json({ 
                        message: '登入成功！', 
                        username: user.username,
                        token: token
                    });
                });
            } else {
                res.status(401).json({ message: '帳號或密碼錯誤' });
            }
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 檢查登入狀態 API
app.get('/api/check-auth', authenticateUser, (req, res) => {
    res.json({ isAuthenticated: true, username: req.user.username });
});

// 系統參數 API
// 獲取所有系統參數
app.get('/api/params', authenticateUser, (req, res) => {
    db.all('SELECT * FROM sys_parainfo', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// 新增系統參數
app.post('/api/params', authenticateUser, (req, res) => {
    const { param_code, param_value, param_desc, sys_flag } = req.body;
    db.run('INSERT INTO sys_parainfo (param_code, param_value, param_desc, sys_flag) VALUES (?, ?, ?, ?)',
        [param_code, param_value, param_desc, sys_flag || 'N'],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.status(201).json({ id: this.lastID, message: '參數新增成功' });
        });
});

// 更新系統參數
app.put('/api/params/:id', authenticateUser, (req, res) => {
    const { param_code, param_value, param_desc, sys_flag } = req.body;
    db.run('UPDATE sys_parainfo SET param_code = ?, param_value = ?, param_desc = ?, sys_flag = ? WHERE id = ?',
        [param_code, param_value, param_desc, sys_flag, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json({ message: '參數更新成功' });
        });
});

// 刪除系統參數
app.delete('/api/params/:id', authenticateUser, (req, res) => {
    db.run('DELETE FROM sys_parainfo WHERE id = ?', req.params.id, function(err) {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: '參數刪除成功' });
    });
});

// 系統功能 API
// 獲取所有系統功能
app.get('/api/menus', (req, res) => {
    db.all('SELECT * FROM sys_menuinfo ORDER BY dispseq', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// 新增系統功能
app.post('/api/menus', (req, res) => {
    const { paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq } = req.body;
    const lasttm = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
    
    db.run(`INSERT INTO sys_menuinfo (paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lasttm) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [paretid || 0, menuna, menuimg || '', menuurl || '', menonly || 'Y', opennew || 'N', dispseq || '00100', lasttm],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.status(201).json({ menuid: this.lastID, message: '功能新增成功' });
        });
});

// 更新系統功能
app.put('/api/menus/:id', (req, res) => {
    const { paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lastusr } = req.body;
    const lasttm = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
    
    db.run(`UPDATE sys_menuinfo 
            SET paretid = ?, menuna = ?, menuimg = ?, menuurl = ?, 
                menonly = ?, opennew = ?, dispseq = ?, lastusr = ?, lasttm = ?
            WHERE menuid = ?`,
        [paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lastusr, lasttm, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json({ message: '功能更新成功' });
        });
});

// 刪除系統功能
app.delete('/api/menus/:id', (req, res) => {
    db.run('DELETE FROM sys_menuinfo WHERE menuid = ?', req.params.id, function(err) {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: '功能刪除成功' });
    });
});

// 測驗 API
// 獲取所有測驗題目 (不含答案)
app.get('/api/quizzes', authenticateUser, (req, res) => {
    db.all('SELECT id, question, option_a, option_b, option_c, option_d FROM quizzes', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// 即時檢查單一答案
app.post('/api/quiz/check-answer', authenticateUser, (req, res) => {
    const { questionId, answer } = req.body;

    if (!questionId || !answer) {
        return res.status(400).json({ message: '缺少題目 ID 或答案' });
    }

    db.get('SELECT correct_answer FROM quizzes WHERE id = ?', [questionId], (err, row) => {
        if (err) {
            return res.status(500).json({ message: '資料庫查詢錯誤', error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: '找不到該題目' });
        }

        const isCorrect = row.correct_answer === answer;
        res.json({
            isCorrect: isCorrect,
            correctAnswer: row.correct_answer
        });
    });
});

// 登出 API
app.post('/api/logout', authenticateUser, (req, res) => {
    // 清除使用者的 token
    db.run('UPDATE users SET token = NULL WHERE id = ?', [req.user.id], (err) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: '登出成功' });
    });
});

// 設定路由，提供 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 新增功能主頁路由
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// 新增測驗頁面路由
app.get('/quiz', (req, res) => {
    res.sendFile(path.join(__dirname, 'quiz.html'));
});

// 會員管理 API
// 獲取所有會員
app.get('/api/members', authenticateUser, (req, res) => {
    db.all('SELECT id, username FROM users', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// 新增會員
app.post('/api/members', authenticateUser, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '帳號和密碼不能為空' });
    }

    try {
        // 檢查使用者是否已存在
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (row) {
                return res.status(409).json({ message: '此帳號已存在' });
            }

            // 加密密碼
            const hashedPassword = await bcrypt.hash(password, 10);

            // 儲存使用者
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }
                res.status(201).json({ message: '會員新增成功！', userId: this.lastID });
            });
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 更新會員
app.put('/api/members/:id', authenticateUser, async (req, res) => {
    const { username, password } = req.body;
    const userId = req.params.id;

    if (!username) {
        return res.status(400).json({ message: '帳號不能為空' });
    }

    try {
        // 檢查使用者是否存在
        db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!user) {
                return res.status(404).json({ message: '找不到此會員' });
            }

            // 檢查新帳號是否已被其他使用者使用
            db.get('SELECT * FROM users WHERE username = ? AND id != ?', [username, userId], async (err, existingUser) => {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }
                if (existingUser) {
                    return res.status(409).json({ message: '此帳號已被使用' });
                }

                let updateQuery = 'UPDATE users SET username = ?';
                let params = [username];

                // 如果有提供新密碼，則更新密碼
                if (password) {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    updateQuery += ', password = ?';
                    params.push(hashedPassword);
                }

                updateQuery += ' WHERE id = ?';
                params.push(userId);

                db.run(updateQuery, params, function(err) {
                    if (err) {
                        return res.status(500).json({ message: err.message });
                    }
                    res.json({ message: '會員資料更新成功' });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 刪除會員
app.delete('/api/members/:id', authenticateUser, (req, res) => {
    const userId = req.params.id;

    // 檢查是否為最後一個管理員
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        if (result.count <= 1) {
            return res.status(400).json({ message: '無法刪除最後一個會員' });
        }

        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json({ message: '會員刪除成功' });
        });
    });
});

// 啟動伺服器，監聽所有網路介面
app.listen(port, '0.0.0.0', () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
    console.log('您也可以通過以下方式訪問：');
    console.log(`http://[您的IP位址]:${port}`);
}); 