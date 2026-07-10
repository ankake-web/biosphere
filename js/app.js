// ==========================================================================
// BIOSPHERE 単一ESモジュール。js/{data,map,ui,nearby,share,app}.js を元順で連結。
// type="module" で読み込む＝モジュールスコープ（strict・グローバル汚染なし）。
// インラインハンドラ(onclick等)から呼ぶ関数だけを末尾で window に公開している。
// 各セクションは元ファイル単位。編集は該当セクションを直接触ってよい。
// ==========================================================================

// ┌───────────────────────────────────────── data.js ─────────────────────────────────────────┐
/* =====================================================================
   BIOSPHERE — 世界いきもの分布アトラス
   UIは AnimalDataSource(=DATA) だけに依存（seam）。
   v1 = MockDataSource（28種ベタ書き）。
   実データ層：GBIF — 学名→taxonKey を解決し、実観測タイルを地図に重ねる。
   ===================================================================== */

// rank（コモン/レア…）は内部表現として温存。画面には band（生息数のめやす）を出す。
const RARITY = {
  LC:{rank:'コモン',        band:'多い（安定）', jp:'軽度懸念',   en:'Least Concern',         color:'#7aa884', gem:'⬡'},
  NT:{rank:'アンコモン',    band:'やや減少',     jp:'準絶滅危惧', en:'Near Threatened',       color:'#2dd4bf', gem:'◆'},
  VU:{rank:'レア',          band:'少ない',       jp:'危急',       en:'Vulnerable',            color:'#4f9bff', gem:'◆'},
  EN:{rank:'スーパーレア',  band:'ごくわずか',   jp:'絶滅危惧',   en:'Endangered',            color:'#b072ff', gem:'✦'},
  CR:{rank:'レジェンダリー',band:'絶滅寸前',     jp:'近絶滅',     en:'Critically Endangered', color:'#ffb02e', gem:'★'},
  DD:{rank:'データ不足',    band:'不明',         jp:'データ不足', en:'Data Deficient',        color:'#94a3b8', gem:'·'},
  NE:{rank:'未評価',        band:'不明',         jp:'未評価',     en:'Not Evaluated',         color:'#64748b', gem:'·'},
};
// IUCNレッドリスト 9段階（危機が高い順）。色はRARITYと共有し、EX/EW/NE と各段の意味を補う。導線・解説モーダルで使用。
const REDLIST=[
  {code:'EX',jp:'絶滅',                en:'Extinct',                color:'#6b7280',mean:'最後の1個体まで失われ、地球上から姿を消した。'},
  {code:'EW',jp:'野生絶滅',            en:'Extinct in the Wild',    color:'#9aa3ad',mean:'飼育・栽培下にだけ生き残り、野生では絶滅した。'},
  {code:'CR',jp:'近絶滅（深刻な危機）',en:'Critically Endangered',  color:'#ffb02e',mean:'ごく近い将来、野生で絶滅する危険が極めて高い。'},
  {code:'EN',jp:'絶滅危惧',            en:'Endangered',             color:'#b072ff',mean:'近い将来、野生で絶滅する危険が高い。'},
  {code:'VU',jp:'危急',                en:'Vulnerable',             color:'#4f9bff',mean:'絶滅の危険が増大している。'},
  {code:'NT',jp:'準絶滅危惧',          en:'Near Threatened',        color:'#2dd4bf',mean:'今は大丈夫だが、将来的に危惧される可能性がある。'},
  {code:'LC',jp:'軽度懸念',            en:'Least Concern',          color:'#7aa884',mean:'広く分布し個体数も多い。当面の絶滅リスクは低い。'},
  {code:'DD',jp:'データ不足',          en:'Data Deficient',         color:'#94a3b8',mean:'評価に足る情報が不足している。'},
  {code:'NE',jp:'未評価',              en:'Not Evaluated',          color:'#64748b',mean:'まだIUCNの評価対象になっていない。'},
];
const THREAT=['CR','EN','VU'];   // 「絶滅危惧種（Threatened）」のIUCNカテゴリ
const RL=Object.fromEntries(REDLIST.map(r=>[r.code,r]));
// 推定生息数（野生・おおよそ。出典/年により幅あり）
const POP = {
  lion:'約2万〜2.5万頭（2023）', elephant:'約41.5万頭（2016・減少中）', polarbear:'約2.2万〜3.1万頭（2015 IUCN）', penguin:'約25万つがい（2012）',
  kangaroo:'豊富（数千万頭）', panda:'約1,864頭（2014年全国調査）', tiger:'約4,500〜5,600頭（2023推定）', wolf:'約20万〜25万頭（2018推定）',
  jaguar:'約6.4万頭未満（2017 IUCN・成熟個体）', snowleopard:'約4,000〜6,500頭（2016推定）', gorilla:'約31.6万頭（2013推定・急減中）', koala:'約33万頭（2012推定）',
  giraffe:'約11.7万頭（2016）', cheetah:'約6,500〜7,000頭（2016推定）', zebra:'約50万頭（2016 IUCN）', hippo:'約11万〜13万頭（2016 IUCN）',
  orangutan:'約10万頭（2016・急減中）', redpanda:'約1万頭未満（2015 IUCN）', komodo:'約3,000〜3,400頭（2023センサス）', bison:'約3万〜4万頭（2017 IUCN）',
  eagle:'約30万羽以上（2021・回復）', anteater:'推定 数万頭（減少中）', condor:'約6,700羽（2020 IUCN）', otter:'約12.9万頭（2021 IUCN）',
  whale:'約13.5万頭（2018・回復）', arcticfox:'数十万頭（地域差大）', macaque:'約11万頭（1989・日本）', crane:'約3,000羽（2021）',
  rhino:'約6,400頭（2022）', leopard:'推定 数十万頭（減少中）', asianelephant:'約4万〜5万頭（2018 IUCN）', moose:'約150万頭以上',
  raccoon:'豊富（数百万以上）', beaver:'約1,000万〜1,500万頭', capybara:'豊富（数百万）', sloth:'安定（数は不明）',
  toucan:'安定（数十万以上）', flamingo:'約55万〜68万羽（2018 IUCN）', shoebill:'約5,000〜8,000羽（2018 IUCN）', galapagostortoise:'約2万頭（2017・回復中）',
  alligator:'約500万頭（回復）', greenturtle:'推定 数十万頭（成熟個体は減少）', whaleshark:'推定 減少中（数は不明）', orca:'約5万頭以上（2006推定）',
  greatwhite:'推定 希少（数は不明）', albatross:'約2万羽（2018 IUCN）', humboldtpenguin:'約2万〜3万羽（2020）', platypus:'推定 数万〜数十万頭',
  tasmaniandevil:'約2万〜2.5万頭（激減）', kiwi:'約3.5万羽（2000推定）', redfox:'豊富（数百万以上）', brownbear:'約20万頭（2016 IUCN）',
  walrus:'約22万〜25万頭', narwhal:'約12万〜17万頭（2017 IUCN）', meerkat:'安定（数十万）', okapi:'約1万〜3.5万頭（2015 IUCN）',
  axolotl:'野生1,000頭未満（2019 IUCN・ほぼ絶滅）', loggerhead:'推定 数十万頭（成熟個体は減少）', slothbear:'約7,000〜2万頭（2016 IUCN）', kingpenguin:'約223万つがい（2020 BirdLife・増加中）',
};
const popOf = (a)=>(a&&a.pop)||(a&&POP[a.id])||'データ不足';
// 個体数トレンド（↑増加/↓減少/→横ばい/–不明）。回復種だけ明示し、他はIUCN状況から導出。
const TREND_UP=['panda','tiger','eagle','bison','alligator','whale','beaver','galapagostortoise','otter','raccoon','arabianoryx','przewalski','whiterhino','northerncardinal','kanadagan','osprey','reddeer','muteswan','easterngraysquirrel','pileatedwoodpecker','annashummingbird','rubythroatedhummingbird','atlanticbluefintuna','peregrinefalcon','whitetailedeagle','rainbowlorikeet','americanblackbear','sulphurcrestedcockatoo','californiasealion','blackwoodpecker','bluewhale','bowheadwhale'];
const TREND_DOWN=['monarch','firefly','bullshark','firesalamander','oceansunfish','eurasianredsquirrel','leatherbackseaturtle','shortfinmako','redeyedtreefrog','europeanhedgehog','hawksbillseaturtle','tigershark','europeanrabbit','spottedeagleray','scallopedhammerhead','queenalexandrasbirdwing','giantoceanicmantaray','sandtigershark','easterndiamondbackrattlesnake','gilamonster','reindeer','gharial','snowyowl','africanbuffalo','americanpika','blacktailedprairiedog','scarletmacaw','greycrownedcrane','greaterrhea','proboscismonkey'];
function trendOf(a){
  if(TREND_UP.includes(a.id)) return 'up';
  if(TREND_DOWN.includes(a.id)) return 'down';
  if(a.status==='LC') return 'stable';
  return 'unknown';   // 実トレンド未キュレーションは「不明」＝IUCNカテゴリだけで一律「減少」と過剰主張しない（捏造しない）
}
const TREND_META={up:{a:'↑',t:'増加',c:'#5fd39a'},down:{a:'↓',t:'減少',c:'#ff9a8a'},stable:{a:'→',t:'横ばい',c:'#9fb0bd'},unknown:{a:'–',t:'不明',c:'#9fb0bd'}};
// 高位分類（哺乳/鳥/爬虫/両生/魚/昆虫/植物/無脊椎）。図鑑の絞り込み用にidで明示（既定＝哺乳類）。
const CLASS={
  菌類:['shiitake','bunashimeji','eringi','maitake','enokitake','aragekikurage','nameko','shirokikurage','kikurage','mushroom','hiratake','tamogitake','yamabushitake','hatakeshimeji','honshimeji','reishi','agaricus','fukurotake','hanabiratake','kinugasatake','matsutake','hanaiguchi','murasakishimeji','shirotruffle','yamadoritake','yamadoritakemodoki','anzutake','saketsubatake','kurotruffle','kurorappatake','amitake','amigasatake','numeriiguchi','naratake','mukitake','kuritake','shouro','chichitake','hatsutake','akayamadori','sakurashimeji','tamagotake','urabenihoteishimeji','houkitake','shougenji','masutake','shimofurishimeji','usuhiratake',],
  鳥類:['niwatori','ahiru','bariken','shinagachou','uzura','kanaria','urokoinko','shiroharainko','akikusainko','delichondasypus','spodiopsarcineraceus','juushimatsu','domesticpigeon','bunchou','mameruriha','corvusmacrorhynchos','amatsubame','komadori','mebosomushikui','japanesegreenwoodpecker','asianbrownflycatcher','ashyminivet','redneckedstint','littletern','pacificloon','okinawarail','okinawawoodpecker','ryukyurobin','ryukyuscopsowl','amamiwoodcock','lidthsjay','amamithrush','whistlinggreenpigeon','rhinocerosauklet','spectacledguillemot','penguin','eagle','condor','crane','toucan','flamingo','shoebill','albatross','humboldtpenguin','kiwi','kingpenguin','ostrich','steller','peafowl','mallard','northerncardinal','kanadagan','osprey','aosagi','muteswan','pileatedwoodpecker','annashummingbird','rubythroatedhummingbird','indigobunting','peregrinefalcon','whitetailedeagle','scarlettanager','rainbowlorikeet','sulphurcrestedcockatoo','eurasianhoopoe','blackwoodpecker','goldeneagle','helmetedguineafowl','westernbarnowl','snowyowl','adeliepenguin','eurasianeagleowl','emu','scarletmacaw','beniflamingo','superblyrebird','momoiropelican','budgerigar','beardedvulture','kuroerihakucho','greycrownedcrane','greaterrhea','secretarybird','kingvulture','harpyeagle','atlanticpuffin','northerngannet','mandarinduck','albertlyrebird','quetzal','kakapo','roadrunner','ivorygull','scarletibis','frigatebird','kingfishercommon','eurasianbullfinch','japanesegrosbeak','blackfacedbunting','longtailedrosefinch','yellowthroatedbunting','blueandwhiteflycatcher','redflankedbluetail','daurianredstart','siberianrubythroat','eurasiannuthatch','longtailedtit','japanesewhiteeye','japanesebushwarbler','martialeagle','africanhawkeagle','crownedeagle','africanfisheagle','easternmarshharrier','greyfacedbuzzard','mountainhawkeagle','commonbuzzard','orientalhoneybuzzard','merlin','turkeyvulture','greathornedowl','tawnyowl','shortearedowl','spectacledowl','africangreyparrot','blueandyellowmacaw','sunparakeet','monkparakeet','galah','cockatiel','whitecockatoo','roseringedparakeet','peachfacedlovebird','salmoncrestedcockatoo','eclectusparrot','australiankingparrot','crimsonrosella','greatspottedwoodpecker','keelbilledtoucan','coppersmithbarbet','northerncassowary','mikadopheasant','greatargus','redjunglefowl','crestedpartridge','victoriacrownedpigeon','nicobarpigeon','emeralddove','greaterbirdofparadise','wilsonsbirdofparadise','rufousbelliedkookaburra','orientalcuckoo','oldworldcuckoo','ruddyshelduck','whooperswan','purpleheron','blackcrownednightheron','blackfacedspoonbill','crestedibis','whitestork','maraboustork','blackcrownedcrane','demoisellecrane','hoodedcrane','laysanalbatross','eurasiancoot','blackfootedalbatross','sootyshearwater','bluefootedbooby','redfootedbooby','brownbooby','redbilledtropicbird','redfacedcormorant','pelagiccormorant','rockhopperpenguin','magellanicpenguin','eurasiancurlew','fareasterncurlew','commonredshank','commongreenshank','ruddyturnstone','pacificgoldenplover','greyplover','blackwingedstilt','piedavocet','blackheadedgull','europeanherringgull','slatybackedgull','blacktailedgull','eurasiansiskin','hawfinch','variedtit','coaltit','redtailedhawk','hoodedvulture','cinereousvulture','griffonvulture','burrowingowl','militarymacaw','hyacinthmacaw','lesserspottedwoodpecker','europeangreenwoodpecker','eurasianwryneck','greatbarbet','europeanbeeeater','europeanroller','largehawkcuckoo','crestedkingfisher','tundraswan','barnaclegoose','cacklinggoose','lesseradjutant','saruscrane','limpkin','commonmoorhen','blackbrowedalbatross','streakedshearwater','tuftedpuffin','commonmurre','pigeonguillemot','bartailedgodwit','sanderling','dunlin','littleringedplover','kentishplover','eurasianoystercatcher','beehummingbird','swordbillhummingbird','marvelousspatuletail','bootedrackettail','littlehermit','crimsonsunbird','purplethroatedsunbird','paradisetanager','scarletbackedflowerpecker','newhollandhoneyeater','redcrestedcardinal','lazulibunting','redbilledleiothrix','redcappedmanakin','andeancockoftherock','wiretailedmanakin','scaledantpitta','rufoustailedjacamar','indianpitta','sunbittern','hoatzin','japaneseparadiseflycatcher','asianparadiseflycatcher','longtailedbroadbill','greatercrackedtaileddrongo','spangleddrongo','commonblackbird','willierfantail','mistlethrush','redwingthrush','whitesthrush','japanesewaxwing','bohemianwaxwing','japaneseaccentor','zittingcisticola','orientalreedwarbler','whitewagtail','olivebackedpipit','eurasianskylark','blacknapedoriole','eurasianjay','yellowbelliedsunbird','helmetedhoneyeater','redwingedblackbird','amazonianumbrellabird','rufoushornero','collaredtrogon','hoodedpitta','palethrush','eurasiantreecreeper','easterncrownedwarbler','goldcrest','buffbelliedpipit','giganthummingbird','longtailedsylph','sparklingvioletear','velvetpurplecoronet','greatsapphirewing','andeanhillstar','greenbeardedhelmetcrest','shiningsunbeam','redtailedcomet','buffwingedstarfrontlet','tourmalinesunangel','collaredinca','crownedwoodnymph','violetsabrewing','fierythroatedhummingbird','whitetippedsicklebill','rufousbreastedhermit','blacktailedtrainbearer','purplethroatedmountaingem','speckledhummingbird','amethystwoodstar','longbilledhermit','scissortailedhummingbird','hoodedwarbler','buffytuftedstartip','americanredstart','blackthroatedgreenwarbler','commonyellowthroat','ovenbird','greenhoneycreeper','summertanager','bluegraytanager','palmtanager','silverbeakedtanager','redleggedhoneycreeper','cactuswren','whitethroatedsparrow','goldencrownedsparrow','songsparrow','easternbluebird','mountainbluebird','westernmeadowlark','baltimoreoriole','bobolink','yellowheadedblackbird','roseroastedgrosbeak','paintedbunting','southernredbishop','pintailwhydah','socialweaver','greaterblueearedstarling','redbilledoxpecker','southerngroundhornbill','crownedhornbill','violetturaco','northerncarminebeeeater','greyturaco','hartlaubsturaco','littlebeeeater','africangreyhornbill','greybackedfiscal','africandarter','yellowbilledhornbill','hwamei','crestedbarbet','blackthroatedlaughingthrush','redwhiskeredbulbul','redventedbulbul','crestedmyna','commonmyna','javanmyna','hillmyna','bluewingedpitta','greenbroadbill','silverbreastedbroadbill','orientalpiedhornbill','rhinoceroshornbill','koklass','greathornbill','wreathedhornbill','silverpheasant','whitebrowedfantail','asianfairybluebird','puffthroatedbabbler','regentbowerbird','goldenfrontedleafbird','satinbowerbird','superbfairywren','greatbowerbird','redbackedfairywren','noisyminer','splendidfairywren','australianmagpie','piedbutcherbird','helmetedfriarbird','duskywoodswallow','palmcockatoo','whitebreastedwoodswallow','raggianabirdofparadise','gangganghoneycockatoo','easternspinebill','bluefacedhoneyeater','kingbirdofparadise','easternwhipbird','japanesegreenpigeon','japaneseimperialpigeon','eurasiancollareddove','africancollareddove','mourningdove','mountainimperialpigeon','wongapigeon','commonwoodpigeon','stockdove','pintailedsandgrouse','blackbelliedsandgrouse','asiankoel','greatercoucal','chestnutwingedcuckoo','asianemeraldcuckoo','laughingdove','namaquadove','pheasantcoucal','oriantalturtledove','diamonddove','barshouldereddove','spotbilledduck','eurasianteal','falcatedduck','baikalteal','tuftedduck','greaterscaup','smew','commonmerganser','commongoldeneye','harlequinduck','longtailedduck','velvetscoter','blackscoter','greaterwhitefrontedgoose','swangoose','brantgoose','beangoose','canvasback','commonshelduck','greategret','intermediateegret','littleegret','striatedheron','japanesenightheron','yellowbittern','pacificreefheron','eurasianbittern','blackheadedibis','chineseegret','hadadaibis','woollyneckedstork','glossyibis','sandhillcrane','purpleswamphen','watercock','ruddycrake','siberiancrane','blackneckedgrebe','hornedgrebe','slatybreastedrail','greatcrestedgrebe','littlegrebe','blackkite','roughleggedbuzzard','eurasiansparrowhawk','northerngoshawk','japanesesparrowhawk','crestedserpenteagle','greaterspottedeagle','blackshoulderedkite','steppeeagle','crestedcaracara','laughingfalcon','lesserkestrel','gyrfalcon','redfootedfalcon','aplomadofalcon','montagusharrier','blackbreastedbuzzard','swallowtailedkite','bateleur','uralowl','collieredscopsowl','orientalscopsowl','brownhawkowl','blakistonfishowl','borealowl','africanscopsowl','eurasianpygmyowl','spottedowlet','easternscreechowl','greynightjar','europeannightjar','greatgrayowl','tawnyfrogmouth','commonpotoo','commonswift','littleswift','whitethroatedneedletail','alpineswift','chimneyswift','verreauxeagleowl','firewoodgatherer','littlethornbird','crestedhornero','whiteplumedantbird','blackcrownedantshrike','spottedantbird','crestedoropendola','vermilionflycatcher','cattletyrant','swallowtanager','redcrestedfinch','plushcrestedjay','yabusame','chifuchafu','morimushikui','himekoyoshikiri','ezosennyu','makibatahibari','kubiwamushikui','karafutomushikui','sekkamushikui','kawarahibari','yoshikirise','hibariko','greywoodpecker','whitebackedwp','nuttallswp','downywoodpecker','rufouswoodpecker','greatslatybilledwp','browncreeper','whitewingedwp','middlespottedwp','velvetfrontednuth','beltedkingfisher','collaredkingfisher','amazonkingfisher','sacredkingfisher','woodlandkingfisher','brownwingedkingfisher','whitethroatedbeeeater','bluecheekedbeeeater','indianroller','pittalikegroundroller','amazonianmotmot','whiteneckedjacobin','yellowwarbler','bananaquit','darkeyedjunco','longtailedwidowbird','redbilledquelea','silverycheekedhornbill','lilacbreastedroller','whitehelmetshrike','vulturineguineafowl','goldenbreastedstarling','superbstarling','taiwanhwamei','mustachedlaughingthrush','mistletoebird','eurasianwigeon','northernpintail','northernshoveler','trumpeterswan','hennarrier','greyfalcon','longearedowl','oilbird','barredantshrike','yellowrumpedcacique','longtailedtyrant','greathornedtyrant','forktailedflycatcher','capuchinbird','greatantshrike','ezomushikui','oomushikui','kitayanagimushikui','kohibari','himekoutenshi','shimasennyu','kimayumushikui','kanmurihibari','hamahibari','sabakuhibari','tahibarisuteppe','japanesepygmywp','acornwoodpecker','beardedwoodpecker','whitebreastednuth','chestnutvnuthatch','africanpygmykingfisher','rufousbackeddwarfkingfisher','shovelbilledkookaburra','rainbowbeeeater','broadbilledroller','cubantody','jamaicantody','abyssiniangroundhornbill','redbilledhornbill','africanpiedhornbill','whitethighedhornbill','speckfrontedweaver','yellowcrownedbishop','redcollaredwidowbird','baglafechtweaver','whitebrowedsparrowweaver','beautifulsunbird','collaredsunbird','scarletchestedsunbird','purpleroller','whitefrontedbeeeater','baterleaur','lappetfacedvulture','hamerkop','africanharrierhawk','africanopenbill','abdimsstork','greaterflamingoaf','blackheron','africanpygmygoose','spurwingedgoose','egyptiangoose','bronzemannikin','easternparadisewhydah','capeglossystarling','violetbackedstarling','redbilledoxpecker2','lilactroupant','greatblueturaco','redfacedmousebird','whitebelliedgoaway','speckledmousebird','africanpittabird','greyheadedkingfisher','africanparadiseflycatcher','southernredbilledhornbill2','southernboubou','redwingedstarling','redeyeddove','groundscraper','yellowbilledkite','baterstork','kori','africanfinfoot','crownedlapwing','hartlaubsbustard','redfacedcrombec','fischerslovebird','crestedfrancolin','yellowneckedspurfowl','whitebreastedcormorant','africanskimmer','bateleurfish','africanwoodowl','dideriskcuckoo','africangreenbroadbill','greywoodpecker2','goldenweaver','lessermaskedweaver','spectacledweaver','blackwingedbishop','bluewaxbill','jamesonsfirefinch','cutthroatfinch','greenwingedpytilia','africanfirefinch','redbilledbuffaloweaver','yellowwhiteeye','rosyfinchlark','capewhiteeye','capegannet','africanpenguin','hartlaubsgull','capecormorant','jacksonswidowbird','africanjacanalesser','rednecktedfrancolin','fieryneckednightjar','bareyedoxpecker','pennantwingednightjar','capeshoveler','africanopenbillblack','yellowbilledduck','emeraldcuckoo','speckledpigeon','africanwagtail','capewagtail','crownedeagleafrican','redfacedbarbet','blackcollaredbarbet','dhoneyguide','tawnyflankedprinia','africanhobby','greaterkestrel','africanpittagreen','africangoshawk','purpleswamphen2','redknobbedcoot','gallussonneratii','buceroshydrocorax','pavomuticus','rhinoplaxvigil','ocycerosbirostris','acerosnipalensis','daceloovaesguineae','halcyonsmyrnensis','tanysipterasylvia','actenoidesconcretus','meropsleschenaulti','nyctyornisathertoni','anthochaeracarunculata','philemoncorniculatus','ptiloriparadiseus','epimachusfastosus','seleucidesmelanoleucus','psittaculaeupatria','loriculusvernalis','calyptorhynchusbanksii','loriuslory','charmosynapapou','geoffroyusgeoffroyi','dacelogigas','aegithinatiphia','chloropsiscochinchinensis','copsychussaularis','leucopsarrothschildi','arachnotheralongirostra','treronvernans','duculabicolor','harpactesoreskios','dendrocygnajavanica','ephippiorhynchusasiaticus','anastomusoscitans','metopidiusindicus','hydrophasianuschirurgus','galloperdixspadicea','lophophorusimpejanus','chrysolophuspictus','alectorischukar','pternistispictus','catreuswallichii','oriolustraillii','haliasturindus','buboniensis','nisaetuscirrhatus','ketupaketupu','glaucidiumradiatum','batrachostomusjavensis','aerodramusfuciphagus','grallinacyanoleuca','streperagraculina','chalcophapsstephani','manucodiakeraudrenii','dacelotyro','daphoenosittachrysoptera','toxoramphusnovaeguineae','eopsaltriaaustralis','petroicagoodenovii','chenonettajubata','acanthizapusilla','threskiornisspinicollis','egrettanovaehollandiae','esacusmagnirostris','morusserrator','anousstolidus','haematopuslongirostris','burhinusgrallarius','leipoaocellata','numidiacaledonica','acanthisittachloris','alecturalathami','gallirallusaustralis','cyanorhamphusnovaezelandiae','hemiphaganovaeseelandiae','coracinanovaehollandiae','sphecotheresvieilloti','ailuroedusmelanotis','melampittalugubris','ptilorisvictoriae','cracticusquoyi','manucodiaater','pithecophagajefferyi','casuariusbennetti','gallicolumbaluzonica','berenicornisscomatus','rhyticerosalbirostris','loriculusgalgulus','enicurusleschenaulti','garrulaxleucolophus','hypothymisazurea','orthotomussutorius','amandavaamandava','taeniopygiaguttata','neochmiatemporalis','struthideacinerea','oreoicagutturalis','lichenostomuschrysops','dicruruschibia','aplonispanayensis','saxicolacaprata','motacillamaderaspatensis','alaudagulgula','cyanocittacristata','poecileatricapillus','mimuspolyglottos','spinustristis','haemorhousmexicanus','pipiloerythrophthalmus','passerculussandwichensis','protonotariacitrea','spizatigrina','sialiamexicana','dumetellacarolinensis','polioptilacaerulea','reguluscalendula','tyrannustyrannus','colaptesauratus','melanerpeserythrocephalus','dryobatesvillosus','callipeplacalifornica','meleagrisgallopavo','bonasaumbellus','aixsponsa','anasamericana','buchephalaalbeola','accipitercooperii','podilymbuspodiceps','egrettathula','ardeaherodias','plataleaajaja','gimericana','fulicaamericana','gallinulagaleata','himantopusmexicanus','limosafedoa','actitismacularius','scolopaxminor','sternahirundo','haematopuspalliatus','progneubis','hirundorustica','chordeilesminor','corvuscorax','aphelocomacalifornica','perisoreuscanadensis','cistothoruspalustris','passerdomesticus','icteriavirens','euphaguscyanocephalus','coccothraustesvespertinus','spinuspinus','spizelloidesarborea','chondestesgrammacus','setophagapinus','plectrophenaxnivalis','sphyrapicusruber','picoidesarcticus','toxostomacurvirostre','myiarchuscinerascens','tyrannusforficatus','empidonaxtraillii','oreothlypiscelata','cardellinacanadensis','antrostomusvociferus','megascopskennicottii','aegoliusacadicus','coragypsatratus','circushudsonius','marecastrepera','aythyacollaris','chenrossii','ansercaerulescens','phalaropustricolor','gallinagodelicata','bartramialongicauda','thalasseusmaximus','sternulaantillarum','oreothlypisruficapilla','juncooreganus','melozonefusca','cardinalissinuatus','toxostomalecontei','oreoscoptesmontanus','salpinctesobsoletus','nucifragacolumbiana','picahudsonia','sittapygmaea','pooecetesgramineus','setophagastriata','psittacaraleucophthalmus','brotogerisversicolurus','amazonaoratrix','amazonaaestiva','forpuspasserinus','tangaraseledon','tangaragyrola','cyanerpescaeruleus','sporophilacaerulescens','eulampisjugularis','phaethornissuperciliosus','heliodoxajacula','pitangussulphuratus','formicariusanalis','gymnopithystorquatus','pteroglossustorquatus','ibycterameridicanus','eumomotasuperciliosa','aulacorhynchusprasinus','cotingacayana','pipraerythrocephala','cyanocoraxyncas','cyanocoraxcyanomelas','quiscalusmexicanus','volatiniajacarina','sicalisflaveola','zonotrichiacapensis','synallaxisalbescens','phacellodomusruber','thraupisornata','tangaracyanicollis','tachyphonusrufus','iridosornisanalis','oreomanesfraseri','chlorornisriefferii','crotophagaani','guirgura','turdusrufiventris','vanelluschilensis','theristicuscaudatus','jabirumycteria','mycteriaamericana','phoenicopteruschilensis','phoenicoparrusandinus','dendrocygnaviduata','penelopeobscura','chaunatorquata','tinamusmajor','psophiacrepitans','megaceryletorquata','chloroceryleamericana','colaptesmelanochloros','melanerpescandidus','selenideraculik','conirostrumspeciosum','tangaravelia','xiphorhynchusguttatus','lepidocolaptesangustirostris','campylorhynchusturdinus','progneschalybea','embernagrabrunneinucha','poospizanigrorufa','tachuriraubrigastra','agelaioidesbadius','hydropsalistorquata','colaptescampestris','aratinganenday','bolborhynchuslineola','tigrisomalineatum','phimosuinfuscatus','spizaetusornatus','himantopusmelanurus','pteroglossusinscriptus','rostrhamussociabilis','semnornisramphastinus','capitobrunnerifrons','xipholenapunicea','querulapurpurata','thamnophiluscaerulescens','myrmotherulaaxillaris','phaethornisruber','conopophagalineata','anthracothoraxnigricollis','lesbianuna','commonredpoll','commonlinnet','eurasianchaffinch','europeanserin','twite','treepipit','waterpipit','greywagtail','eurasianwren','calandralark','dunnock','alpineaccentor','bluethroat','commonredstart','europeanstonechat','northernwheatear','blackearedwheatear','eurasianreedwarbler','cettiswarbler','blackcap','sardinianwarbler','firecrest','europeanpiedflycatcher','greattit','marshtit','willowtit','beardedreedling','redbackedshrike','greatgreyshrike','eurasianmagpie','spottednutcracker','eurasianjackdaw','carrioncrow','eurasiantreesparrow','spanishsparrow','hoodedcrow','rosystarling','garganey','redbreastedmerganser','greylaggoose','blacktailedgodwit','commonsandpiper','greenppiper','ruff','eurasianwoodcock','commonsnipe','commonringedplover','housemartin','northernlapwing','sandmartin','booteagle','redkite','shorttoedsnakeeagle','egyptianvulture','commonkestrel','hobby','littleowl','westernmarshharrier','littlebittern','blackstork','waterrail','corncrake','commoncrane','greatbustard','littlebustard','westerncapercaillie','blackgrouse','willowptarmigan','rockptarmigan','redleggedpartridge','greypartridge','commonquail','rockdove','redthroatedloon','greatcormorant','europeanturtledove','lesserblackbackedgull','commongull','blackleggedkittiwake','blackguillemot','greatskua','manxshearwater','northernfulmar','europeanstormpetrel','stonecurlew','goldenoriole','crestedtitmouse','whitethroateddipper','copperpheasant','japanesetit','brownearedbulbul','japanesewagtail','japanesepheasant','japanesethrush','japanesescopsowl','japanesewhitenapedcrane','japanesecormorantumiu','japanesemurrelet','japanesefairypitta','japanesewhitebellied','japanesebrownshrike','japanesedipper','japanesebuntings','trumpeterhornbill','blackcasquedhornbill','villageweaver','southernmaskedweaver','whitebilledbuffaloweaver','redheadedweaver','malachitesunbird','amethystsunbird','southerncarmine','crestedguineafowl','palmnutvulture','whitebackedvulture','baterhawk','augurbuzzard','saddlebilledstork','yellowbilledstork','sacredibis','africanspoonbill','africanjacana','knobbilledduck','redcheekedcordonbleu','redbilledfirefinch','violeteareawaxbill','commonwaxbill','yellowbilledoxpecker','greenwoodhoopoe','malachitekingfisher','piedkingfisher','giantkingfisher','forktaileddrongo','crimsonbreastedshrike','capesugarbird','africangreenpigeon','dharedandyellowbarbet','africanhoopoe','redcrestedkorhaan','africanwattledlapwing','blacksmithlapwing','goldentailedwoodpecker','meyersparrot','brownparrot','sccoccolafrancolin','reedcormorant','capeturtledove','longtailedcormorant2','whiteheadedvulture','ruppellsvulture','pearlspottedowlet','redchestedcuckoo','whitebrowedcoucal','klaascuckoo','thickbilledweaver','shaftailedwhydah','hottentotteal','africanmourningdove','darkcappedbulbul','redeyedbulbul','baterbird2','greenpigeonafrican','gabargoshawk','baterbirddove','polyplectronbicalcaratum','ceyxerithaca','myzomelasanguinolenta','loburia','ailuroeduscrassirostris','casuariuscasuarius','dicaeumtrigonostigma','ptilinopusmagnificus','chrysocolapteslucidus','anthracoceroscoronatus','nettaporhynchacoromandeliana','amaurornisphoenicurus','vanelluindicus','eurylaimusochromalus','caprimulgusasiaticus','hemiprocnecomata','corcoraxmelanorhamphos','orthonyxtemminckii','diphyllodesmagnificus','pachycephalapectoralis','colluricinclaharmonica','climacterispicumnus','cracticustorquatus','pardalotuspunctatus','anseranassemipalmata','tachybaptusnovaehollandiae','platalearegia','pelecanusconspicillatus','phaethonrubricauda','fregataariel','ardeotisaustralis','turnixvarius','nestornotabilis','megapodiusreinwardt','anhinganovaehollandiae','microcarbomelanoleucos','oriolussagittatus','vitellineweaver','northernredbishop','whiteheadedbuffaloweaver','chestnutweaver','forestweaver','cuckoofinch','variablesunbird','copperysunbird','maricosunbird','orangebreastedsunbird','greatersunbird','redchestedsunbird','yellowrumpedtinkerbird','blackandwhitecasquedhornbill','swallowtailedbeeeater','barefacedgoawaybird','purplecrestedturaco','knysnaturaco','westernplantaineater','arrowmarkedbabbler','southernpiedbabbler','whiterumpedbabbler','scalychatterer','grayheadedsparrow','capesparrow','hildebrandtsstarling','wattledstarling','redbilledoxpecker3','yellowthroatedpetronia','fischersstarling','quailfinch','pintaildwhydah2','whitebrowedscrubrobin','goldenbreastedbunting','yellowfrontedcanary','whitebelliedbustard','senegalcoucal','streakyseedeater','bellminer','littlewattlebird','yellowwattlebird','whiteplumedhoneyeater','littlefriarbird','whitenapedhoneyeater','spinycheekedhoneyeater','singinghoneyeater','lewinshoneyeater','brownhoneyeater','eungellahoneyeater','macleayshoneyeater','yellowtailedblackcockatoo','scalybreastedlorikeet','australianringneck','redrumpedparrot','paleheadedrosella','swiftparrot','bluebonnetparrot','zebrafinch','gouldianfinch','nzfantail','flamerobin','scarletrobin','whitebrowedscrubwren','stribbedpardalote','crestedshriketit','dollarbird','brownheadedthrush','duskythrush','narcissusflycatcher','blueflycatcher','palelegged','yellowwagtail','welcomeswallow','crestedpigeon','maskedlapwing','australasianswamphen','pukeko','kaka','powerfulowl','wedgetailedeagle','spotteddove','whistlingkite','brownshrike','chestnutcheekedstarling','shorttoedtreecreeper','yellowwagtail2','rockbunting','ortolanbunting','blackredstart','whinchat','songthrush','thrushnightingale','melodiouswarbler','icterinewarbler','gardenwarbler','lesserwhitethroat','spottedflycatcher','collaredflycatcher','lessergreyshrike','woodchatshrike','commoncrossbill','europeangoldfinch','pinkfootedgoose','woodsandpiper','littlestint','europeanhoneybuzzard','eurasianspoonbill','redbilledchough','alpinechough','rook','cretzschmarsbunting','whitethroatedrobin','upchersswarbler','wallcreeper','rocknuthatch','lessergoldfinch','lawrencegoldfinch','graycrownedrosyfinch','blackrosyfinch','easternmeadowlark','rustyblackbird','hoodedoriole','scottsoriole','boattailedgrackle','commongrackle','macgillivraywarbler','mourningwarbler','kentuckywarbler','chestnutsidedwarbler','baybreastwarbler','blackwhitewarbler','northernparula','lucywarbler','virginiawarbler','graytwarbler','commongrounddove','bandtailedpigeon','ruddyquaildove','hairywoodpecker','redcockadedwoodpecker','yellowbelliedsapsucker','gildedflicker','williamsonsapsucker','swainsonhawk','whiteheadwoodpecker','harrishawk','ferruginoushawk','sharpshinnedhawk','broadwingedhawk','redshoulderedhawk','whitetailedhawk','graybhawk','zonetailedhawk','whiskeredscreechowl','flammulatedowl','spottedowl','northernpygmyowl','willet','longbilledcurlew','solitarysandpiper','semipalmatedsandpiper','americanavocet','killdeerna','redknotna','surfbird','goldentanager','bluenecktanager','flametanager','scarletbelliedtanager','bluecappedtanager','flamerumpedtanager','blackfacedtanager','whitecappedtanager','masketcrimsontanager','blackfacedgrassquit','bluedacnis','bluackseedeater','palefaced','rustymargined','pyroderusfruitcrow','boattilledflycatcher','bareneckedfruitcrow','screamingpiha','whitebellbird','bluackbackedmanakin','whitebeardedmanakin','bluecrownedmanakin','paleleggedhornero','plaintxenops','whitewingedcinclodes','scalythroatedearthcreeper','plainthroatedantwren','dotwingedantwren','silveredantbird','bicoloredantbird','blackspottedbarecrimson','rufousantpitta','undulatedantpitta','whitebooted','tawnybellithermitich','foredtailedwoodnymph','violetcappedwoodnymph','whitevoentedplumeleteer','crowedwoodnymph','bluewhiskeredtanager','whiteshoulderedtanager','orangethroatedtanager','chestnutbelliedseedeater','bananaquitmodri','blackcappedhemispingus','barredfruiteater','ochrebreastedantpitta','warblingantbird','palerumpsantbird','streakneckedflycatcher','whiteheadedmarshtyrant','blackphoebe','whiterailedcarib','grassland','sootyheadedbulbul','yellowventedbulbul','whitebrowedbulbul','blackcrestedbulbul','blackbulbul','squaretailedbulbul','junglebabbler','whiteheadedbabbler','tawnybelliedbabbler','abbottsbabbler','chestnutwingedbabbler','pinstripedtitbabbler','whitechestedbabbler','goldenbabbler','greythroatedbabbler','rufousfrontedbabbler','whitehoodedbabbler','lessernecklacedlaughingthrush','whitethroatedlaughingthrush','rufouschinnedlaughingthrush','silverearedmesia','whitebrowedshrikebabbler','chestnutcrownedlaughingthrush','whitebrowedscimitarbabbler','indianscimitarbabbler','blueearedkingfisher','ruddykingfisher','bandedkingfisher','bluethroatedbarbet','brownheadedbarbet','malabargrayhornbill','goldenthroatedbarbet','whitecheekedbarbet','blythshornbill','srilankajunglefowl','kalijpheasant','blackfrancolin','junglebushquail','paintedfrancolin','thickbilledgreenpigeon','orangebreastedgreenpigeon','yellowfootedgreenpigeon','redcollareddove','barredcuckoodove','orangebelliedleafbird','greatslatywoodpecker','blackrumpedflameback','whitethroatedfantail','orangeheadedthrush','malabarwhistlingthrush','greyheadedcanaryflycatcher','greenbeeeater','bluetailedbeeeater','asianbarredowlet','junglebushwarbler','blackdrongo','redbilledbluemagpie','heartspottedwoodpecker','whitebelliedwoodpecker','commonhawkcuckoo','greenbilledmalkoha','purplerumpedsunbird','lotenssunbird','scarletminivet','smallminivet','largeniltava','whitetailedrobin','yellowbrowedbulbul','whitebrowedbushrobin','brownfishowl','indianeaglepowl','greenavadavat','whiterumpedmunia','scalybreastedmunia','blackheadedmunia','bayaweaver','streakedweaver','whitecheekedpartridge','rufousthroatedpartridge','hillpartridge','barbackedpartridge','greaterpaintedsnipe','yellowwattledlapwing','riverlapwing'],
  魚類:['microstomusachne','kareiusbicoloratus','reinhardtiushippoglossoides','eopsettagrigorjewi','pleurogrammusmonopterygius','hexagrammosotakii','inimicusjaponicus','erilepiszonifer','scombropsgilberti','parapristipomatrilineatum','plectorhinchuscinctus','lepidotriglamicroptera','branchiostegusalbus','epinephelusseptemfasciatus','oplegnathuspunctatus','dentexhypselosomus','aluterusmonoceros','acanthopagruslatus','pennahiaargentata','lophiomussetigerus','bothrocarahollandi','muraenesoxcinereus','lateolabraxlatus','upeneusjaponicus','repomucenuscurvicornis','chlorophthalmusalbatrossis','suma','hirasouda','marusouda','muroaji','konoshiro','meaji','ibodai','makajiki','itoyoridai','biwamasu','nigorobuna','hagatsuo','koshinaga','isomaguro','gurukuma','datsu','kaiwari','kusayamoro','menada','kyuuriuo','wataka','gigi','chika','shirauo','shirouo','minamimaguro','ikekatsuo','etsu','mizun','kawahigai','gibachi','ishikariwakasagi','ezougui','marutafish','karafutomasu','kunimasu','sugomoroko','fishgomasaba','fishbinnaga','fishmadara','fishakamutsu','fishkinki','fishnishin','fishamadai','fishmutsu','lepomismacrochirus','kingyo','oikawa','ugui2','aburabote','miyakotanago','kazetogetanago','hotokedojo','nipponbaratanago','tanago','ito','utsusemikajika','ayukake','bouzuhaze','numachichibu','mugitsuku','takahaya','aburahaya','kyusen','kobudai','nishikibera','harisenbon','aigo','kagokakidai','takanohadai','bora','oshorokoma','itasenpara','zenitanago','ukigori','clownfish','mantaray','seahorse','whaleshark','greatwhite','bullshark','oceansunfish','shortfinmako','tigershark','spottedeagleray','scallopedhammerhead','giantoceanicmantaray','indopacificsailfish','atlanticbluefintuna','sandtigershark','frilledshark','leafyseadragon','anglerfish','coelacanth','lionfish','atlanticsalmon','moorishidol','electriceel','manderinfish','tomatoclownfish','linedsurgeonfish','bluetang','threadfinbutterfly','pennantcoralfish','copperbandbutterfly','raccoonbutterfly','emperorangelfish','daisyparrotfish','torafugu','stripedeelcatfish','greathammerhead','smoothhammerhead','oceanicwhitetip','blueshark','porbeagle','commonthresher','baskingshark','megamouthshark','zebrashark','japanesewobbegong','bluntnosesixgill','nursehark','spinydogfish','kitefinshark','greenlandshark','redstingray','bullray','bluespottedribbontail','marbledelectricray','thornbackray','leopardwhipray','commonguitarfish','spottedratfish','elephantfish','bluntnosestingray','atlantictorpedo','ocellateriverstingray','humpheadwrasse','cleanerwrasse','giantgrouper','duskyshark','bigeyethresher','nishikigoi','gengorobuna','sougyo','hakuren','kawamutsu','ugui','neontetra','cardinaltetra','piranha','wels','piraiba','shimadojo','dojo','zebrafish','guppy','discus','oscarcichlid','frontosa','niletilapia','asianarowana','silverarowana','arapaima','polypterus','alligatorgar','africanlungfish','australianlungfish','electriccatfish','nothobranchius','siamesefightingfish','pearlgourami','clownknifefish','medaka','sterlet','paddlefish','muskellunge','nileperch','crestfish','barreleye','gulpereel','viperfish','lanternfish','yokozunaiwashi','alfonsino','rockfishacou','yellowfintuna','skipjacktuna','bluefintuna','swordfish','blackmarlin','mahimahi','japaneseamberjack','pacificsaury','hairtail','colossoma','mekongcatfish','corydoras','angelfish','bowfin','sablefish','sandfish','otomebera','ira','kanmuribera','nanyobudai','irobudai','hibudai','mitsuboshikurosuzume','debasuzumedai','rurisuzumedai','rokusensuzumedai','shirikirurisuzumedai','yamabukisuzumedai','futasujiryukyusuzume','sorasuzumedai','kingyobera','mahaze','yoshinobori','tobihaze','mutsugoro','akebonohaze','hatatatehaze','kuroyurihaze','nijigimpo','kasago','onikasago','minokasago','darumaokoze','benikaeruanko','houbou','kaeruanko','magochi','akebonobutterflyfish','segurobutterflyfish','nisefuurai','yellowtang','gomahagi','nizadai','tenguhagi','kue','akahata','kijihata','madai','chidai','yokosujifuedai','gianttrevally','shimaaji','longnosehawkfish','bigeyetrevally','convicttang','jewelcichlid','convictcichlid','greenterror','reddevilcichlid','jackdempsey','flowerhorn','kribensis','pseudotropheus','tropheusmoorii','julidochromis','lamprologusbrichardi','redrainbowfish','boesemanirainbow','platyfish','swordtail','sailfinmolly','normanslampeye','dwarfgourami','biwakooonamazu','iwatokonamazu','akaza','sailfinpleco','garrarufa','kanehira','yaritanago','motsugo','tamoroko','kamatsuka','nigoi','otocinclus','kokuren','aouo','elephantnose','glassctfish','butterflyfish','clownloach','redtailcat','bigbellyseahorse','thornyseahorse','pygmyseahorse','hanatatsu','alligatorpipefish','grasspuffer','vermiculatedpuffer','purplepuffer','longspinedporcupinefish','longhorncowfish','threadsailfilefish','blackscraper','scrawledfilefish','titantriggerfish','redtoothtriggerfish','cleartriggerfish','picassotriggerfish','nihonunagi','europeunagi','americaunagi','oounagi','hanahigeutsubo','utsubo','zebrautsubo','dokuutsubo','toraitsubo','maanago','chinanago','nishikianago','dainanumihebi','hirame','meitagarei','hoshigarei','matsukawa','ohyo','darumagarei','kawayatsume','umiyatsume','saffroncod','walleyepollock','atlanticcod','europeanhake','capelin','shishamo','sappa','japaneseanchovy','kibinago','roundherring','sockeyesalmon','chumsalmon','cohosalmon','chinooksalmon','masusalmon','browntrout','rainbowtrout','whitespottedchar','japanesewhiting','blackseabream','yellowfinseabream','japaneserockfish','okhotskatka','celestichthysmargaritatus','aphyosemionaustrale','marosatherinaladigesi','pseudomugilfurcatus','hyphessobryconherbertaxelrodi','parosphromenusdeissneri','badisbadis','panaqolusmaccus','farlowellavittata','fundulopanchaxgardneri','melanaurata','nimbochromislivingstonii','julidochromisregani','placidochromis','aulonocaranyassae','uaruamphi','mikrogeoramirezi','apistocacatuoides','altolampcompress','neomultifasciatus','fangtooth','pacifichatchetfish','blackdragonfish','opah','lanternsharkblack','barreleyebrown','bonytongue','johndory','mirrordory','daggertooth','boarfish','pricklefish','galapagosshark','spinnershark','sandbarshark','smallspottedcatshark','velvetbelly','brownbambooshark','whitespottedbamboo','bowmouthguitar','bluntnosestingray2','bluespottedmaskray','sicklefindevilray','electricrayjp','cookiecuttershark','kurosorasuzumedai','bluefintrevally','electricyellow','discusbrown','finepatternpuffer','sunfishslender','tanichthysalbonubes','aplocheiluslineatus','melanotaenipraecox','pristellamaxillaris','herosseverus','copadichromisborleyi','japanesebullhead','epauletteshark','angelsharkjp','houndsharkgummy','giantguitarfish','bullray2','cyprinuscarpio','abramisbrama','phoxinusphoxinus','scardiniuserythrophthalmus','albunusalburnus','puntiustetrazona','sawbwabarbusdenisonii','epalzeorhynchosbicolor','osteochilushasselti','catlacatla','tortor','pseudotropheussp','cichlasomaurophthalmum','cichlaocellaris','herichthyscyanoguttatus','sarotherodonmelanotheron','ictaluruspunctatus','ameiurusmelas','pangasianodonhypophthalmus','wallagoattu','hypostomusplecostomus','ancistruscirrhosus','synodontismultipunctatus','synodontisnigriventris','hyphessobryconeques','gymnocorymbusternetzi','hemigrammuserythrozonus','hyphessobryconpulchripinnis','moenkhausiasanctaefilomenae','piaractusbrachypomus','nematobryconpalmeri','chalceusmacrolepidotus','nothobranchiusrachovii','aphaniusiberus','gambusiaaffinis','helostomatemminckii','channaargus','channastriata','channamicropeltes','lepisosteusosseus','polypterusornatipinnis','erpetoichthyscalabaricus','acipensertransmontanus','husohuso','chitalachitala','monodactylusargenteus','tetraodonnigroviridis','stiphodonpercnopterygionus','rhinogobiusflumineus','odontobutisobscura','periophthalmusbarbarus','sandervitreus','esoxlucius','micropterussalmoides','salvelinusfontinalis','barbonymusgonionotus','coregonuslavaretus','catlocarpiosiamensis','prochiloduslineatus','distichodussexfasciatus','citharinuscitharus','leporinusfasciatus','notropislutrensis','pimephalespromelas','balantiocheilosmelanopterus','labeobicolor','chelaphacep','crossocheilusoblongus','opsariichthysuncirostris','zaccoplatypus','gasterosteusaculeatus','enneacanthusgloriosus','copellaarnoldi','nannostomusbeckfordi','hepsetusodoe','elassomaevergladei','gymnotuscarapo','polypterusdelhezi','chondrostomanasus','sanderlucioperca','amphiprionpercula','amphiprionclarkii','premnasbiaculeatus','dascyllusaruanus','abudefdufsaxatilis','coriswallisi','bodianusrufus','gomphosusvarius','chaetodonvagabundus','chaetodonsemilarvatus','holacanthusciliaris','centropygebicolor','centropygeloriculus','pygoplitesdiacanthus','nasolituratus','siganusvulpinus','pteroisantennata','synanceiaverrucosa','cephalopholisminiata','epinephelusmarginatus','lutjanussebae','lutjanuskasmira','lethrinusnebulosus','sargocentronspiniferum','apogonimberbis','pterapogonkauderni','rachycentroncanadum','makairanigricans','regalecusglesne','thunnusobesus','hippocampushippocampus','aulostomuschinensis','sternoptyxdiaphana','benthosemaglaciale','echeneisnaucrates','triaenodonobesus','orectolobusmaculatus','squatinasquatina','carcharhinusamblyrhynchos','epinepheluscoioides','chaetodonrafflesii','chaetodonornatissimus','genicanthusmelanospilos','acanthurussohal','novaculichthystaeniourus','halichoereschrysus','sparisomaviride','plectorhinchuschaetodonoides','plectorhinchusvittatus','taeniacanthusconvictus','canthigastervalentini','oxymonacanthuslongirostris','apolemichthystrimaculatus','amblyeleotrisguttata','calloplesiopsaltivelis','meiacanthusgrammistes','synchiropuspicturatus','ecsenisbicolor','dactylopterusvolitans','chelidonichthyslucerna','taenianotustriacanthus','solenostomusparadoxus','congerconger','epinephelusstriatus','mycteropercabonaci','ocyuruschrysurus','scophthalmusmaximus','hippoglossushippoglossus','pollachiuspollachius','clupeaharengus','engraulisencrasicolus','trachinotusovatus','seriolalalandi','acanthocybiumsolandri','sparusaurata','dicentrarchuslabrax','mullussurmuletus','thalassomapavo','acanthuruscoeruleus','pomacanthusarcuatus','chaetodoncapistratus','chaetodonbaronessa','amphiprionsandaracinos','cantherhinespullus','halichoeresgarnoti','cephalopholisargus','elagatisbipinnulata','sphyraenajello','macolorniger','gnathanodonspeciosus','epibulusinsidiator','choerodonfasciatus','japanesecrucian','japanesesculpin','japanesemackerel','japanesebarracuda','japanesehalfbeak','japanesehorsemackerel','japanesesardine','japaneseseaperch','japanesebrownangelfish','japaneseyellowtail','japaneseblackrockfish','japanesecatfish','japanesemarbledsole','daniomargaritatus','borarasbrigittae','walkingcatfish','stripedraphael','zebrapleco','c23corydoras','bluecatfish','featherfincatfish','talkingcatfish','columbianshark','kanyu','weatherloach','ripsawcatfish','hillstreamloach','stoneloach','spinedloach','yoyoloach','zebraloach','horsefaceloach','desertpupfish','blueeyekilli','australianrainbow','threadfinrainbow','africanarowana','blackarowana','africanknife','blackghostknife','spottedgar','needlefishfreshwater','atlanticneedlefish','flyingfishtropical','ballyhoo','kissinggourami','knifelivebearer','swampeel','buenosairestetra','redhookmyleus','congotetra','silverdollar','marbledhatchet','blackskirt','wolffish','headstander','snakeskingourami','chocolategourami','pufferpea','bumblebeegoby','peacockgoby','barramundi','tilapiamozambique','figure8puffer','rosybarb','cherrybarb','tinfoilbarb','harlequinrasbora','mahseergolden','giantdanio','reefbodianusmesothorax','reeflachnolaimusmaximus','reefthalassomahardwicke','reefthalassomalucasanum','reefoxycheilinusdigramma','reefanampsesmeleagrides','reeflabrusmixtus','reefsymphodustinca','reefcirrhilabrusexquisitus','reefstethojulisbandanensis','reefmacropharyngodonmeleagris','reefscaruscoeruleus','reefscarusfrenatus','reefchlorurusgibbus','reefbolbometoponmuricatum','reefscaruspsittacus','reefsparisomaaurofrenatum','reefsparisomarubripinne','reefhipposcarusharid','reefamphiprionperideraion','reefamphiprionpolymnus','reefpomacentruspartitus','reefabudefdufvaigiensis','reefstegastespartitus','reefneoglyphidodonmelas','reefdascylluscarneus','reefamblyglyphidodoncuracao','reefamphiprionephippium','reefvalencienneastrigata','reefgobiodonokinawae','reefelacatinusoceanops','reefamblygobiusphalaena','reefcryptocentruscinctus','reefstonogobiopsnematodes','reefkoumansettarhinorhynchos','reefgobiuscruentatus','reeftrimmacana','reefthalassomaquinquevittatum','reefhalichoerescosmetus','reefhalichoeresiridis','reefcheilinustrilobatus','reefhologymnosuslongipes','reefanampscaeruleopunctatus','reefcirrhilabruscyanopleura','reefpseudodaxmoluccanus','reefscarusprasiognathos','reefscarusflavipectoralis','reefcirrhilabruslubbocki','reefscarusrubroviolaceus','reefscarusquoyi','reefchromisnotata','reefchromischromis','reefpomacentrusmoluccensis','reefpomacentrusalleni','reefabudefdufsordidus','reefchrysipteratalboti','reefplectroglyphidodonlacrymatus','reefamphiprionbicinctus','reefamblygobiusrainfordi','reefptereleotriszebra','reefamblyeleotrisrandalli','reefgobiodonhistrio','reefbathygobiusfuscus','reefpomacentruspavo','reeflabroidesbicolor','reefcoricherea','chaetodonkleinii','chaetodonulietensis','chaetodonmeyeri','chaetodontrifascialis','chaetodonoctofasciatus','heniochusmonoceros','heniochusvarius','chaetodonfasciatus','chaetodontrifasciatus','chaetodonwiebeli','chaetodonauripes','chaetodonspeculum','hemitaurichthyspolylepis','chaetodonstriatus','chaetodonocellatus','parachaetodonocellatus','pomacanthussemicirculatus','pomacanthusannularis','pomacanthusmaculosus','pomacanthuszonipectus','pomacanthussexstriatus','holacanthustricolor','centropygebispinosa','centropygeloricula','centropygeargi','centropygeferrugata','centropygeflavissima','centropygepotteri','centropygeacanthops','chaetodontopluspoortmani','acanthurusleucosternon','acanthurusolivaceus','acanthurusjaponicus','acanthurusdussumieri','acanthurusmata','acanthurusnigrofuscus','acanthuruschirurgus','zebrasomaveliferum','zebrasomaxanthurum','ctenochaetustominiensis','ctenochaetusstriatus','nasovlamingii','lutjanusgibbus','lutjanusfulviflamma','lutjanusargentimaculatus','lutjanuscampechanus','lutjanusapodus','symphoruslymphorus','epinephelusmerra','aprionvirescens','epinephelustauvina','variolalouti','plectropomusleopardus','anyperodonleucogrammicus','ostorhinchusaureus','sphaeramianematoptera','apogonmaculatus','chaetodonpunctatofasciatus','chaetodonreticulatus','pomacanthusrhomboides','lutjanusquinquelineatus','lutjanuslutjanus','lutjanuscarponotatus','acanthurusthompsoni','nasohexacanthus','chaetodonlineolatus'],
  爬虫類:['jimuguri2','sakishimahabu','iwasakisedakahebi','garasuhiba','erabuumihebi','barbourtokage','okinawatokage','heragurohimetokage','aokanahebi','sakishimakanahebi','komodo','galapagostortoise','alligator','greenturtle','loggerhead','kingcobra','marineiguana','chameleon','saltwatercrocodile','greeniguana','leatherbackseaturtle','hawksbillseaturtle','oliveridleyturtle','spectacledcaiman','centralbeardeddragon','nilecrocodile','leopardtortoise','greenbasilisk','easterndiamondbackrattlesnake','frilledlizard','gilamonster','indiancobra','reticulatedpython','tuatara','greenanaconda','blackmamba','gharial','aldabragianttortoise','gilamonster2','perentie','tokaygecko','leopardgecko','gartersnake','cornsnake','boaconstrictor','matamata','ballpython','rainbowboa','emeraldtreeboa','gaboonviper','puffadder','cottonmouth','russellsviper','habu','deathadder','mamushi','easternbrownsnake','inlandtaipan','tigersnake','easterngreenmamba','egyptiancobra','boomslang','californiakingsnake','yellowbelliedseasnake','sulcatatortoise','pancaketortoise','easternboxturtle','japanesepondturtle','ploughsharetortoise','reevesturtle','redearedslider','alligatorsnapper','commonsnapper','chinesesoftshell','flatbackturtle','chinesealligator','blackcaiman','orinococrocodile','siamesecrocodile','muggercrocodile','japanesegecko','rhinocerosiguana','veiledchameleon','jacksonschameleon','flyingdragon','shingleback','savannahmonitor','nilemonitor','commonwalllizard','armadillolizard','sidewinder','easterncoralsnake','kempsridley','falsegharial','freshwatercrocodile','galapagoslandiguana','easternwaterdragon','bluetongueskink','watermonitor','texashornedlizard','aodaisho','shimahebi','yamakagashi','eggeatingsnake','redpipesnake','jimuguri','carpetpython','radiatedtortoise','indianstartortoise','africanhelmetedturtle','woodturtle','diamondbackterrapin','greentreepython','pignosedturtle','razorbackmusk','redbelliedshorttoise','helmetedgecko','leachianusgecko','crestedgecko','goulddaygecko','fattailedgecko','velvetgecko','henkelileaftail','satanicleaftail','moorishgecko','turkishgecko','minamiyamori','tawayamori','onnadakeyamori','asianhousegecko','kuroiwagecko','namibwebfooted','cavegecko','japalura','higashinihontokage','okadatokage','sandfishskink','fireskink','forestdragon','knightanole','desertiguana','chuckwalla','fijiiguana','indochinawaterdragon','pygmychameleon','crestedlizard','thornydevil','ocellatedlizard','sandlizard','viviparouslizard','westernbluetongue','centralfijiiguana','cubanrockiguana','butterflyagama','takachihohebi','hibakari','akamata','blackratsnake','shuda','montpelliersnake','grasssnake','northernwatersnake','easternhognose','sunbeamsnake','easternindigo','mangrovesnake','asianvinesnake','deadleafsnake','keelbackwater','hermanntortoise','greektortoise','marginatedtortoise','kleinmannstortoise','russiantortoise','burmesestartortoise','foresthingebacktortoise','chacotortoise','europeanpondturtle','mississippimapturtle','paintedturtle','yellowmuddturtle','razorbackmuskturtle','stripedmudturtle','chinesepondturtle','ryukyuleafturtle','yellowmarginedboxturtle','saltwatercrocodileturtle','chinesestripeneckedturtle','spinyturtle','bigheadedturtle','gargoylegecko','knobtailedgecko','barkinggecko','crownedgecko','europeanleafgecko','flyingrivergecko','greenanole','monkeytailskink','foxsnake','smoothgreensnake','flyingsnake','blindsnake','tentacledsnake','malayanboxturtle','japanesecladelizard','corallussnake','yellowanaconda','africanrockpython','woma','capecobra','blackheadedpython','monocledcobra','rhinocerosviper','europeanadder','sawscaledviper','timberrattlesnake','copperhead','ferdelance','bushmaster','chinesecobra','gophersnake','milksnake','californiakingsnake2','vinesnake','kukrisnake','greenvinesnake','lacemonitor','uromastyx','leaftailgecko','daygecko','glasslizard','flapneckchameleon','collaredlizard','slowworm','galloticgiant','galapagoslavalizard','americancrocodile','dwarfcaiman','dwarfcrocodile','kingsnakescarlet','sandboa','rubberboa','aesculapiansnake','forestcobra','ringhals','browntreesnake','caterpillarviper','templeviper','sawscaledcarpet','eyelashviper','levantineviper','nosehornedviper','prairierattlesnake','komodofalse','crocodilemonitor','emeraldmonitor','mangrovemonitor','mooris','flatlizard','spinytailedlizard','goldengecko','muskturtle','spinysoftshell','fourlinedsnake','dicesnake','checkeredkeelback','lownitaipan','ackiemonitor','hierogliphicwhip','caymanblueiguana','whiptaillizard','madagascarboa','dumerilboa','horneddesertviper','caspianturtle','westafricancrocodile','chineseskink','zebratailedlizard','chinesecrocodilelizard','goldengreentreesnake','redspittingcobra','pachydactyluscapensis','tarentolaangustimentalis','hemidactylusmabouia','stenodactylussthenodactylus','phelsumalaticauda','phelsumaquadriocellata','eurydactylodesagricolae','lygodactyluspicturatus','diplodactylusgaleatus','saltuariuscornutus','strophurusciliaris','triocerosmelleri','rieppeleonbrevicaudatus','bradypodionthamnobates','agamaagama','agamamwanzae','calotesversicolor','trapeluagilis','phrynocephalusmystaceus','iguanadelicatissima','anolissagrei','anoliscristatellus','sceloporusoccidentalis','sceloporusmagister','podarcissicula','podarcisbocagei','ophisopselegans','eremiasarguta','gallotiagalloti','egerniacunninghami','plestiodonlaticeps','trachylepisquinquetaeniata','mabuyamabouya','tribolonotusgracilis','varanusgouldii','varanusalbigularis','varanusmertensi','tupinambismerianae','aspidoscelissexlineata','gymnophthalmusspeciosus','gerrhosaurusmajor','pseudopusapodus','platysaurusintermedius','xenosaurusgrandis','lanthanotusborneensis','chamaesauraanguina','lialisburtonis','pygopuslepidopodus','xantusiavigilis','lepidophymaflavimaculatum','ablepharuskitaibelii','chalcidesstriatus','gonocephalusgrandis','aporosauradorsalis','holaspissguentheri','sitananaponensis','latastialongicaudata','lampropholisguichenoti','carliabicarinata','iberolacertamonticola','emoiaatrocostata','leiocephaluscarinatus','tropidurustorquatus','quedenfeldtiamoerens','phymaturuspatagonicus','paroedurapicta','afroedurapondolia','homopholiswahlbergii','heteronotiabinoei','pseudothecadactyluslindneri','aeluroscalabotesfelinus','christinusmarmoratus','gonatodesalbogularis','sphaerodactylusmacrolepis','thecadactylusrapicauda','anguisveronensis','apathyahispanica','viperinesnake','leopardsnake','balkanwhip','catsnakeeuro','nightsnakeus','mudsnake','wormsnakeus','ringnecksnake','redbellysnake','greensnakerough','aquaticgarter','westernterrestrial','checkeredgarter','plainsgarter','queensnake','plainbelly','diamondbackwater','bandedwater','southernhognose','grayband','scarletking','mountainking','prairiekingsnake','whipstriped','cribo','goldenflying','catnosedsnake','orientalratsnake','copperheadedracer','kukrisnake2','trinketsnake','catsnakeasian','keelbackasian','buffstriped','wolfsnake','dogtoothcatsnake','dioneratsnake','amurratsnake','mandarinratsnake','blotchedsnake','redbambooratsnake','chinesecobra2','indochinesespitting','philippinecobra','caspiancobra','westerngreenmamba','kraitcommon','bandedkrait','coastaltaipan','mulgasnake','texascoral','aquaticcoral','aspviper','meadowviper','seakraitbanded','jararaca','westerndiamondback','neotropicalrattlesnake','chinesepitviper','malayanpitviper','popespitviper','rosyboa','burmesepython','sandboa2','indianpython','childrenspython','bloodpython','philippinecrocodile','gophertortoise','mapturtle','redfootedtortoise','yacarecaiman','blandingsturtle','cootersouthern','floridasoftshell','hardunsnake','chickenturtle','twigsnake','filesnake','madagascartreeboa','westernhognosecoral','tigerratsnakeasia'],
  両生類:['zhangixalusschlegelii','hakonesanshouuo','ranasakuraii','ranapirica','ranauenoi','hynobiusnaevius','hynobiusstejnegeri','hynobiusboulengeri','hynobiusfossigenus','hynobiusabuensis','ottonfrog','namiefrog','ranatsushimensis','axolotl','giantsalamander','dartfrog','firesalamander','tigersalamander','redeyedtreefrog','poisondartfrog','canetoad','surinamtoad','hellbender','smoothnewt','goliathfrog','goldenpoisonfrog','glassfrog','americanbullfrog','japanesetreefrog','forestgreentreefrog','blackspottedpondfrog','commontoad','japanesecommontoad','asianhornedfrog','argentinehornedfrog','commonspadefoottoad','darwinsfrog','goldenmantella','chinesegiantsalamander','iberianribbednewt','spottedsalamander','bandedtigersalamander','mudpuppy','twotoedamphiuma','easternnewt','greatcrestednewt','alpinenewt','redbacksalamander','europeantreefrog','tomatofrog','japanesefirebellynewt','blacksalamander','cobaltpoisonfrog','fantasticpoisonfrog','threestripeddartfrog','splashbackpoisonfrog','redheadedpoisonfrog','painteddartfrog','whitestreepfrog','yellowtreefrog','cranwellshornedfrog','surinamhornedfrog','waxymonkeyfrog','magnificenttreefrog','tigerlegmonkeyfrog','vietnamesemossyfrog','madagascangoldenfrog','kajikafrog','jacksonsmantella','reticulatedtreefrog','phantasmalpoisonfrog','clownedtreefrog','emeraldglassfrog','redbackedpoisonfrog','yamaakagaeru','borneoflyingfrog','tagogaeru','numagaeru','tsuchigaeru','darumagaeru','nagarehikigaeru','miyakohikigaeru','europeanakagaeru','americanspadefoot','mexicanburrowingtoad','rainfrog','desertrainfrog','africanreedfrog','hidasanshouuo','kurosanshouuo','touhokusanshouuo','ooitasanshouuo','ezosanshouuo','kasumisanshouuo','midwifetoad','microhylaornata','wallaceflyingfrog','whitelippedtreefrog','madagascarbrightfrog','purplefrog','abesalamander','splendidleaffrog','nihonakagaeru','ranitomeyaimitator','dendrobatesauratus','hylacinerea','lithobatespipiens','lithobatessylvaticus','pyxicephalusadspersus','atelopuszeteki','xenopuslaevis','dermatonotusmuelleri','kaloulapulchra','nyctibatrachushumayuni','telmatobiusculeus','calyptocephalellagayi','centroleneprosoblepon','scinaxruber','smiliscaphaeota','hyperoliusviridiflavus','afrixalusfornasini','zhangixalusarboreus','chiromantismicrops','feijervyalimnocharis','hoplobatrachustigerinus','limnonectesblythii','sooglossusgardineri','leiopelmahochstetteri','pseudacriscrucifer','bombinaorientalis','scaphiopuscouchii','eleutherodactyluscoqui','paedophryneamauensis','limnodynastesdumerilii','crinissignifera','ranaaurora','ranadraytonii','litoriainfrafrenata','ranaboylii','amolopsricketti','quasipaaspinosa','stauroisparvus','duttaphrynusmelanostictus','incilliusalvarius','anaxyrusboreas','ambystomaopacum','proteusanguinus','sirenlacertina','cynopsorientalis','tarichagranulosa','paramesotritonhongkongensis','tylototritonverrucosus','echinotritonandersoni','aneidesvagrans','bolitoglossarostrata','salamandrellakeyserlingii','ranodoussibiricus','rhyacotritonolympicus','ichthyophisglutinosus','geotrypetesseraphini','oreobatesquixensis','hylodesasper','gastrothecariobambae','cruziohylacraspedopus','pithecopusazureus','chacophryspierottii','thoropahmiliaris','hylascutaria','nanorananepalensis','xenopustropicalis','silurananchain','polypedatesmegacephalus','kurixaluseiffingeri','megophrysnasuta','scutigerboulengeri','latoniainsignifera','ranadalmatina','ranaarvalis','pelophylaxlessonae','glandirananakagawai','babinabaibana','limnonectesfragilis','pachyhynobiusshangchengensis','calotritonasper','ensatinaeschscholtzii','batrachosepsattenuatus','pseudobranchusstriatus','ambystomaopacumii','taricharivularis','heleioporusalbopunctatus','notadenbennettii','litorianasuta','assaurleola','uperoleialaevigata','raorchestesglandulosus','indiranabeddomii','micrixaluskottigeharensis','chiromantisrufescens','polypedatesotilophus','phlyctimantisverrucosus','ptychadenamascareniensis','cacosternumboettgeri','conrauacrassipes','dendrobatesgaleritus','ameeregabassleri','phyllobatesvittatus','colostethuspanamansis','agalychnisspurrelli','callimedusahypochondrialis','espadaranaprosoblepon','isthmohylapseudopuma','dryophyteschrysoscelis','pseudacrisregilla','tlalocohylaloquax','itapotihylalanguida','scinaxquinquefasciatus','physalaemuscuvieri','hylodesphyllodes','boanandotti','ranoideacaerulea','mixophyesfasciolatus','litoriawilcoxii','anaxyrusamericanus','pelophylaxridibundus','hemisusmarmoratus','trichobatrachusrobustus','physalaemuspustulosus','osteopilusseptentrionalis','boanafaber','kassinasenegalensis','scaphiophrynegottlebei','boophismadagascariensis','occidozygalima','bombinabombina','pachytritonbrevipes','desmognathusfuscus','euryceabislineata','hydromantesitalicus','batrachuperuspinchonii','typhlonectesnatans','hypogeophisrostratus','lepidobatrachuslaevis','hynobiustokyoensis','neurerguskaiseri','euproctusplatycephalus','ommatotritonophryticus','ambystomagracile','ranoideaaurea','sphaerothecabreviceps','barkingtreefrog','squirreltreefrog','graytreefrog','daintytreefrog','borealchorusfrog','canyontreefrog','emeraldeyedtreefrog','maptreefrog','cinnamontreefrog','pickerelfrog','southernleopardfrog','ediblefrog','iberianfrog','pyreneanfrog','greentoad','crestedtoad','kihansispraytoad','easternnarrowmouthtoad','corroboreefrog','turtlefrog','guttraltoad','raucoustoad','chineseflyingfrog','malabarglidingfrog','okinawatreefrog','tigerfrog','tinkerfrog','yellowbelliedtoad','parsleyfrog','marblednewt','swordtailnewt','palmatenewt','texasblindsalamander','slimysalamander','caucasussalamander','iberianmidwifetoad','pacificgiantsalamander','longtoedsalamander','caecilianyellow','oregonspottedfrog','cascadesfrog','mountainyellowleggedfrog'],
  昆虫:['inshanenagainago','inskurosuzumebachi','inszazamushi','ischnurasenegalensis','hydrophilusacuminatus','megacoptapunctatissima','usubakicho','takanehikage','miyamamonkicho','daisetsutakanehikage','benihikage','ooichimonji','kumomabenihikage','kumomatsumakicho','asahihyoumon','parnassiusglacialis','hestinapersimilis','nymphalisxanthomelas','ypthimaargus','arhopalajaponica','nannophyapygmaea','kanabun','ezozemi','matsumushi','orangeoakleaf','greatnawab','miyamashirocho','takanekimadaraseseri','euremamandarina','araschniaburejana','nanafushi','onbubatta','monarch','honeybee','firefly','sevenspotladybird','paperkitebutterfly','bluemorpho','herculesbeetle','goliathusgoliatus','queenalexandrasbirdwing','dungbeetle','giantasianhornet','goldenringeddragonfly','giantstagbeetle','mincicada','asianswallowtail','chinesemantis','giantwaterbug','atlasmoth','machaon','saturniapyri','cetoniaaurata','anaxjunius','romalea','lampyris','phyllium','lucanuscervus','mikadoageha','heliconius','dokucho','kuroageha','tsumabenicho','benishijimi','monshirocho','oomurasaki','komurasaki','hyomoncho','kujakucho','himeakatateha','ruritateha','caucasusbeetle','atlasbeetle','satanbeetle','japanesebeetle','hiratastagbeetle','miyamastagbeetle','giraffestagbeetle','jewelbeetle','groundbeetle','divingbeetle','heikefirefly','tigerbeetle','ginyanma','akiakane','choutonbo','shoujou','tonosamabatta','sabakutobi','shouryou','kurumabatta','hanakamakiri','konohamushi','suzumushi','kera','japanesehoneybee','yellowhornet','carpenterbee','bumblebee','leafcutterant','fireant','slavemakerant','japanesecarpenterant','higurashicicada','tsukutsukuboushi','asagimadara','murasakishijimi','zephyrus','janomecho','akatateha','eupatorusbeetle','sawstagbeetle','cyclommatusstagbeetle','konohakamakiri','kirigirisu','kutsuwamushi','driverant','redcarpenterant','oomizuao','onagamizuao','yamamayuga','shinjusan','usutabiga','oosukashiba','benisuzume','ebigarasuzume','mengatasuzume','kuromengatasuzume','sesujisuzume','ooshimofurisuzume','akebikonoha','ibotaga','ootomoe','hitoriga','shirohitori','oominoga','kurosujiginyanma','kyouchikutousuzume','ruriboshiyanma','shiokaratombo','shioyatombo','yotsuboshitombo','usubakitombo','miyamaakane','aohadatombo','ooaoitotombo','aoitotombo','monosashitombo','shirosujikamikiri','gomadarakamikiri','ruriboshikamikiri','ramiikamikiri','taitanusubakamikiri','oozousumushi','jingasahamushi','oosenchikogane','aodougane','aohanamuguri','benibotaru','joukaibon','karasuageha','miyamakarasuageha','onagaageha','jakouageha','gifuchou','himegifuchou','monkiageha','yamatoshijimi','rurishijimi','torafushijimi','uranamishijimi','kuromadarasotetsushijimi','aobaseseri','daimyoseseri','ichimonjiseseri','komisuji','ichimonjichou','kitateha','ginichimonjiseseri','kobaneinago','kimadaraseseri','yabukiri','sasakiri','umaoi','okamekoorogi','tsuduresasekoorogi','harabirokamakiri','hinakamakiri','kokamakiri','usubakamakiri','moribatta','kusakiri','satsumagokiburi','yamatoshiroari','taiwanshiroari','tsuchiinago','kogatasuzumebachi','monsuzumebachi','seguroashinagabachi','kiashinagabachi','futamonashinagabachi','kuromaruhanabachi','oohakiribachi','kuroyamaari','tobiirokeari','akasujikinkamemushi','shioyaabu','hanaabu','namihirataabu','kurokanabun','yotsuboshikeshikisui','marugatagomimushi','kogashiramizumushi','kogamushi','kurogengoro','jokaibon','aojokai','himegengoro','shiroshitaba','benishitaba','musashinokishitaba','monshidemushi','yotouga','hasumonyotou','yomogiedashaku','namishaku','tsutoga','chadokuga','dokuga','maimaiga','kareha','obikareha','matsukareha','hyoutangomimushi','miideragomimushi','kuromarukogane','nagasakiageha','benimonageha','himesuzumebachi','chairosuzumebachi','koaohanamuguri','shimagengoro','haiirogengoro','awayotou','hiroheriaoiraga','aoiraga','danauschrysippus','morphopeleides','caligoeurilochus','greataopera','agraulisvanillae','aglaisurticae','polygoniacalbum','araschnialevana','euphydryasaurinia','junoniacoenia','charaxesjasius','siproetastelenes','cethosiacyane','cyresticthyodamas','papiliopalinurus','papiliopolyxenes','graphiumagamemnon','irisornisplanchei','parnassiusapollo','zerynthiapolyxena','pierisbrassicae','coliascroceus','phoebissennae','catopsiliapomona','deliashyparete','polyommatusicarus','phengarisarion','arhopalabazalus','chrysozephyrus','hesperiacomma','thymelicussylvestris','aphantopushyperantus','lethediana','bicyclusanynana','actiasluna','aglaismilberti','rothschildiaarbri','automerisio','saturniapavonia','hyleseuphorbiae','smerinthusocellatus','laothoepopuli','tyriajacobaeae','callimorphadominula','utetheisaornatrix','chrysiridiarhipheus','campaeamargaritaria','abraxasgrossulariata','cossuscossus','zygaenafilipendulae','thysaniaagrippina','ascalaphaodorata','thaumetopoeapityocampa','bombyxmori','papiliobianor','papiliorutulus','colotiseucharis','salamishyparete','papiliodardanus','charaxescandiope','battuspolydamas','parideslysander','cethosiabiblis','doleschalliabisaltide','coloburadirce','marpesiapetreus','ogyrisamaryllis','acraeaandromacha','heteronymphamerope','papilioaegeus','phoeshermes','anteoschlorinde','chlosynelacinia','euptoietaclaudia','hipparchiasemele','erebiaaethiops','argyreusniphe','melanitisleda','discophoracelinde','euploeacore','ideomalisarda','tirumalaseptentrionis','brintesiacirce','iphiclidespodalirius','smyrnablomfildia','colaenisjulia','agriasclaudina','anaeaandria','catonephelenumilia','nessaeaobrinus','sphragiformeleukops','eumorphapandorus','sphinxperelegans','pergesaelpenor','bhutanitislidderdalii','meandrusapyrhippus','papilioconstantinus','megasomaelephas','oryctesnasicornis','phanaeusvindex','melolonthamelolontha','chrysinaresplendens','cicindelachinensis','carabusauratus','calosomasycophanta','anoplophoraglabripennis','cicindelacampestris','batocerarubus','adaliabipunctata','sternocerasternicornis','staphylinusolens','necrophorusvespilloides','sitophilusoryzae','rhynchophorusferrugineus','tenebriomolitor','anaximperator','sympetrumstriolatum','calopteryxsplendens','libelluladepressa','corduliaaenea','aeshnacyanea','tettigoniaviridissima','caloptenusitalicus','oedipodacaerulescens','ruspoliadifferens','gryllusbimaculatus','achetadomesticus','xylocopaviolacea','vespavelutina','polistesdominula','oecophyllasmaragdina','formicarufa','chrysopaperla','libelloideslongicornis','corydaluscornutus','lyristesplebejus','graptopsaltrianigrofuscata','pomponiaimperatoria','pyrrhocorisapterus','graphosomalineatum','graphocephalacoccinea','halyomorphahalys','cercopisvulnerata','palomenaprasina','lethocerusindicus','ranatralinearis','periplanetaamericana','gromphadorhinaportentosa','carausiusmorosus','extatosomatiaratum','trichodesalvearius','oxytheabipunctata','cantharisfusca','buprestismariana','saperdacarcharias','leptinotarsadecemlineata','timarchatenebricosa','oryctesrhinoceros','sagrabuqueti','anthiasexguttata','phalacrognathusmuelleri','mormolycephyllodes','goliathusregius','dynastesneptunus','euchromagigantea','megasomaactaeon','sphaeriumblue','petrognathagigas','hoplianthribus','aularchesmiliaris','phymateusviridipes','oxyachinensis','oecanthuspellucens','deinacridaheteracantha','stagmomantiscarolina','andrenafulva','megachilerotundata','osmiabicornis','polistesfuscatus','dolichovespulamaculata','odontomachusbauri','dorylusnigricans','erythemissimplicicollis','rhyothemisvariegata','cordulegasterboltonii','plateaumarisbicolor','cybistertripunctatus','pelidnotapunctata','polybothriswallacei','euchirislongimanus','oncopeltusfasciatus','pteroptyxmalaccae','cicadettamontana','fulgoralaternaria','stagmatopteramaculata','pyropscandelaria','oryctesboas','hopliacoerulea','prioninuscoriarius','chalcophoramariana','japanesepaleclouded','japanesegreentigerbeetle','japanesehoverfly','japanesegiantwaterbug','japanesewaterstrider','dogbanebeetle','mustardbeetle','tortoisebeetlegreen','swampmilkweedbeetle','willowleafbeetle','ragwortfleabeetle','mintleafbeetle','stripedcucumberbeetle','lilyleafbeetle','asparagusbeetle','redlilydotbeetle','eucalyptusleafbeetle','caraganaweevil','boweevil','grainweevil','maizeweevil','vineweevil','scarletlilybeetleasia','acornweevil','giraffeweevil','agavesnoutweevil','cottonstemweevil','hazelnutweevil','clovweevil','pineweevil','figwortweevil','eucalyptussnoutweevil','greenjunebeetle','bluegroundbeetle','harlequinbeetlecarab','fierysearcher','violetgroundbeetle','bombardierbeetle','northernduneiger','strandlinebeetle','caspiantigerbeetle','emeraldashborer','kingdungbeetle','minotaurbeetle','dorbeetle','summerchafer','tenlinedjunebeetle','japanesebeetlepop','gardenchafer','wheatwireworm','eyedclickbeetle','stagbeetlelesser','whitespottedchafer','leafbeetlepoplar','cerealbeetlered','grapecolaspis','redshoulderedleaf','cowpeaweevil','clovleafweevil','nettleweevil','birchleafroller','oakleafroller','elmbarkbeetle','coffeeberryborer','barkbeetlespruce','leafminingjewel','carabbeetlenotch','southernpinebeetle','floweringchafergiant','jewelbeetlegold','africanflowerbeetlepurple','leafbeetlemetallic','leafbeetlecolorful','beetleflowerlong','weevilfern','leafbeetlereddish','weevilgiantjapan','metallicwoodborersteelblue','chafercupreous','morimuscerdo','jewelbeetlecherry','acanthocinusaedilis','cerambyxcerdo','lamiatextor','aromiamoschata','leptureaquadrifasciata','stenocorusmeridianus','stictoleptura','clytusarietis','anaglyptusmysticus','rutpelamaculata','plagionotusarcuatus','agapanthiavillosoviridescens','oberealinearis','tetropsprausta','spondylisbuprestoides','ergateswfaber','asemumstriatum','arhopalusrusticus','rhagiuminquisitor','monochamussutor','anoplophorachinensis','batocerawallacei','tragosomadepsarium','dorcusparallelipipedus','sinodendroncylindricum','odontolabiscuvera','lamprimaadolphinae','figulusbinodulus','polyphyllafullo','hoplialrgentea','mecynorrhinatorquata','anoxiavillosa','harmoniaaxyridis','halyziasedecimguttata','exochomusquadripustulatus','rodoliacardinalis','hippodamiaconvergens','dytiscuslatissimus','cybisterlateralimarginalis','hydrophiluspiceus','orthetrumcancellatum','brachytroniapratense','aeshnagrandis','sympetrumsanguineum','coenagrionpuella','calopteryxvirgo','leucorrhiniadubia','sympecmafusca','sympetrumflaveolum','stethophymagrossum','trithemisannulata','brachythemisleucosticta','neurobasischinensis','epiophlebiasuperstes','perithemistenera','tramealacerata','celithemiseponina','ophiogomphusarolus','gomphusflavipes','diplacodeslefebvrii','neurothemisfluctuans','copperaannulata','ceriagriondecoratum','coenagrionmercuriale','leucorrhiniapectoralis','sympetrumdanae','lindeniatetraphylla','w7i3grasseggplant','w7i3egyptiangh','w7i3redwing','w7i3commongreengh','w7i3mottledgh','w7i3bluewingedgh','w7i3riverbedgh','w7i3rattlegh','w7i3wartbiter','w7i3darkbush','w7i3speckledbush','w7i3sicklebearing','w7i3saddlebush','w7i3woodcricket','w7i3treewetanz','w7i3elegantgh','w7i3koppiefoam','w7i3variegatedgh','w7i3carolinagh','w7i3twostripedgh','w7i3clouded','w7i3americanbird','w7i3newzealandcicada','w7i3ashcicada','w7i3clearwinged','w7i3greengrocer','w7i3blackprince','w7i3narrowwingedmantis','w7i3conehead','w7i3doubledrummer','w7i3conehead2','w7i3spinystick','w7i3jungnymph','w7i3javanleaf','w7i3giantshieldbug','w7i3boxelderbug','w7i3harlequin','w7i3masskissingbug','w7i3backswimmer','w7i3spittlebug','w7i3cottonstainer','w7i3lanternfly','w7i3dwarfhoneybee','w7i3commoncarder','w7i3rustypatched','w7i3easterncarpenter','w7i3orientalhornet','w7i3germanwasp','w7i3mudauber','w7i3velvetant','w7i3africandriverant','w7i3honeypotant','w7i3argentineant','w7i3bulletant','w7i3bulldogant','w7i3jackjumper','w7i3giantforestant','w7i3blackgardenant','w7i3yellowmeadowant','w7i3harvesterant','w7i3sweatbee','w7i3ivybee','w7i3sirex','w7i3fieldwaspring','w7i3braconid','w7i3figwasp','w7i3hoverfywasp','w7i3antlionadult','w7i3snakeflycom','w7i3mantidflycom','w7i3owlfly','w7i3katydidtrue','w7i3budwing','w7i3giantasianmantis','w7i3ferghana','w7i3boxelder2','w7i3bedbug','w7i3tibicenlinnei','w7i3dogdaycicada','w7i3treehopper','w7i3buffalotreehopper','w7i3blueeyedgh','w7i3rufousbush','w7i3upland','lep1charaxesbrutus','lep1polyuraathamas','lep1polyurahebe','lep1kalimaparalekta','lep1junoniaorithya','lep1hypolimnasmisippus','lep1nymphalisantiopa','lep1argynnispaphia','lep1speyeriacybele','lep1boloriaselene','lep1limenitisarthemis','lep1adelphabredowii','lep1biblishyperia','lep1callicoreastarte','lep1letheuropa','lep1mycalesismineus','lep1pararaegeria','lep1oeneischryxus','lep1danausgenutia','lep1caligomemnon','lep1tithoreaharmonia','lep1polyommatusbellargus','lep1cyanirissemiargus','lep1aricaagestis','lep1callophrysrubi','lep1jamidescelano','lep1acraeaterpsicore','lep1coliaseurytheme','lep1euremahecabe','lep1leptosianina','lep1gonepteryxrhamni','lep1anaphaeisaurota','lep1papiliopolytes','lep1papiliodemoleus','lep1battusphilenor','lep1parnassiusmnemosyne','lep1thymelicuslineola','lep1ochlodessylvanus','lep1pyrrhopygearaxes','lep1borbocinnara','lep1junoniaevarete','lep1cepatophrasia','lep1neptishylas','lep1ariadnemerione','lep1euthaliaaconthea','lep1tanaeciajulii','lep1cirrochroatyche','lep1acraeahorta','lep1graphiumpolicenes','lep1eronialeda','lep1mylothrisagathina','lep1dixeiacharina','lep1leptomyrinahirundo','lep1junoniavillida','lep1vanessakershawi','lep1cressidacressida','lep1lexiasdirtea','lep1elymniashypermnestra','lep1faunisceylonica','macroglossumstell','acherontiaatropos','hemarisfuciformis','hemaristityus','ceratomiaamyntor','hylescelerio','hyalophoracecropia','callosamiapromethea','imbrasiaepimethea','gonimbrasiabelina','citheroniaregalis','anisotasenatoria','euplagiaquadri','spilosomalubricipeda','actiasselene'],
  植物:['cabbage','redcabbage','brusselssprouts','broccoli','romanesco','cauliflower','kale','kailan','kohlrabi','petitvert','broccolini','komatsuna','napacabbage','turnip','mizuna','nozawana','bokchoy','norabona','mibuna','nanohana','hiroshimana','sugukina','tatsoi','tennojikabura','santosai','hinona','katsuona','atsumikabu','shogoinkabu','kakina','mustardgreens','takana','zhacai','wasabina','daikon','radish','sakurajimadaikon','moriguchidaikon','kaiwaredaikon','nerimadaikon','miuradaikon','shogoindaikon','watercress','yuriwasabi','arugula','horseradish','sagarame','akamoku','sujiaonori','bouaonori','usubaaonori','makusa','ogonori','dulse','mafunori','egonori','habanori','sansai01','sansai02','sansai04','sansai05','sansai06','sansai08','sansai13','sansai11','sansai16','sansai17','sansai18','sansai19','sansai20','sansai22','sansai23','sansai28','sansai29','sansai31','sansai35','sansai36','sansai37','sansai39','sansai41','sansai42','sansai43','sansai48','sansai50','sansai52','sansai53','sansai45','sansai54','aojiso','akajiso','egoma','myoga','myogatake','sansai55','kinome','hojiso','sansho','misansho','mitsuba','itomitsuba','benitade','shoga','hajikami','yomogi','sweetbasil','holybasil','peppermint','spearmint','rosemary','thyme','dill','fennelleaf','lemongrass','stevia','germanchamomile','summersavory','borage','nasturtium','spicetogarashi','spicecassia','spicenutmeg','spicecardamom','spicefenugreek','spicemustardbrown','spicemustardwhite','spicelaurel','spicestaranise','spicesaffron','spicehuajiao','spicevanilla','spicesesame','spicepoppy','spiceanise','spicecaraway','spiceallspice','spicejuniper','spicelongpepper','spicecelery','spiceajwain','spicenigella','spiceasafoetida','spicepaprika','spicecaper','spiceannatto','spicecubeb','spicegalangal','spicehihatsumodoki','spicesesameblack','spicesesamegold','spicewhitepepper','orange','unshu','navel','valencia','ponkan','bloodorange','dekopon','kiyomi','iyokan','sudachi','grapefruit','buntan','banpeiyu','amanatsu','natsumikan','kinkan','shikuwasa','daidai','bushukan','hyuganatsu','citron','tankan','kishumikan','fuji','kogyoku','tsugaru','jonagold','wanashi','shinanogold','kosui','yonashi','lafrance','momo','nectarine','fuyu','hiratanenashi','jiro','budo','shinemuscat','kyoho','delaware','muscatalexandria','pione','koshu','sakuranbo','sumomo','anzu','prune','biwa','marmelo','ptochiotome','pamaou','pichigo','pbenihoppe','pblackberry','pcranberry','pcassis','pblueberry','pakasuguri','pgooseberry','phaskap','pjuneberry','pelderberry','pcloudberry','ppineapple','pkiwi','pdragonfruit','ppassionfruit','pacerola','pstarfruit','pcherimoya','pcanistel','patemoya','pjaboticaba','psugarapple','ppawpaw','pwaxapple','pmelon','pmuskmelon','pyubari','pprincemelon','pandesmelon','phoneydew','psuika','pkodama','pyellowsuika','pwalnut','pmakuwa','ppecan','phazelnut','ppistachio','pmacadamia','ppinenut','ppumpkinseed','horenso','saladhorenso','lettucehead','shungiku','saladna','romaine','sanchu','endive','stemlettuce','trevise','artichoke','cardoon','fuki','fukinotou','celeriac','parsley','fudanso','italianparsley','beetgreens','okahijiki','shiroza','iceplant','tsuruna','hiyuna','tsurumurasaki','okawakame','yousai','moroheiya','rhubarb','okanori','suiba','egoma2','unzentakana','shiso','toumyou','moyashi','alfalfa','nojisha','asparagus','whiteasparagus','myoga2','mizuuwabamisou','vegmanganjitogarashi','vegkyotakenoko','vegkintokininjin','vegkatsurauri','vegkuwai','vegyamashinanasu','vegutsugikabocha','vegkagarenkon','veghetamurasakinasu','vegtakinogawaninjin','vegmagomehanjirokyuri','vegyamatomana','vegyamatoimo','vegsenryonasu','vegyurugikabu','veghinonakabu','vegsadowaranasu','vegkanpyo','vegmindennasu','vegmiyashigedaikon','shimonitanegi','aonegi','fukayanegi','senjunegi','akanegi','konegi','negibozu','tamanegi','shirotamanegi','hatamanegi','shintamanegi','leek','eshalot','ninniku','ninnikunome','haninniku','nira','hananira','rakkyo','eshalotto','kinira','asatsuki','ninjin','shimaninjin','shingobo','renkon','shinshoga','hagobo','hashoga','yanakashoga','sawawasabi','beets','detroitbeet','daikon2','aokubidaikon','okuradaikon','hatsukadaikon','kabu','tennojikabu','hidabenikabu','akakabu','kuwai','yurine','yacon','parsnip','rutabaga','kikuimo','chorogi','potatojagaimo','potatomeakuin','potatokitaakari','potatoinka','satsumabase','satsumabeniazuma','satsumaannou','satsumanarutokintoki','satobase','satsumasilksweet','satoishikawawase','satododare','satocelebes','satoyatsugashira','satokyoimo','satotaimo','satotaroimo','yamnagaimo','yamyamatoimo','yamichouimo','yammukago','yamdaijo','konjac','cassava','apios','kuzuimo','tacca','shiroguwai','togedokoro','maca','tomatooodama','tomatomini','tomatochudama','tomatofruit','tomatomomotaro','tomatoaiko','tomatomicro','tomatopetit','tomatoroma','nasunaga','tomatoyellow','nasubeinasu','nasushiro','nasumaru','nasushoya','nasuko','pepperpiman','nasunagaoka','peppertakanotsume','peppershishito','pepperjalapeno','pepperpoblano','pepperamanaga','peppercayenne','pepperserrano','pepperkorean','pepperanaheim','pepperhabanero','tomatillo','peppertabasco','groundcherry','kyuri','suyokyuri','minikyuri','kuroibokyuri','gherkinkyuri','seiyokabocha','bocchankabocha','yukigeshokabocha','nihonkabocha','butternutkabocha','kurokawakabocha','shimakabocha','zucchini','yellowzucchini','somenkabocha','korinky','goya','pepokabocha','shirogoya','abashigoya','hechima','tokadohechima','tougan','yugao','pattypan','hyotan','hayatouri','shirouri','makuwauri','hagurauri','hebiuri','okra','shirookra','hanaokra','sweetcorn','youngcorn','whitecorn','bicolorcorn','purpleasparagus','daizu','popcorn','mochicorn','kuromame','edamame','aodaizu','tanbaguro','kurakakemame','azuki','dainagon','shiroazuki','sayaingen','ingenmame','kintokimame','uzuramame','shiroingen','tebou','toramame','daifukumame','moroccoingen','greenpeas','kinusaya','sayaendou','miendou','rakkasei','peanut','hiyokomame','renzumame','sasage','juurokusasage','hanamame','murasakihanamame','shirohanamame','raimame','fujimame','natamame','shikakumame','lupinmame','hasshoumame','kimame','ketsuruazuki','ine','uruchimai','mochigome','akamai','kuromai','sakamai','indicarice','japonicarice','durum','spelt','wildrice','triticale','komugi','oomugi','hadakamugi','rokujooomugi','oomugiwakaba','enbaku','raimugi','toumorokoshi','soba','dentcorn','dattansoba','kibi','awa','hie','morokoshi','hatomugi','fonio','shikokubie','toujinbie','quinoa','amaranthus','tanetsukebana','sansai14','sansai21','sansai38','sansai33','sansai44','sage','chervil','tarragon','corianderleaf','spicekosho','spicecumin','lemon','kabosu','hassaku','satonishiki','praspberry','pgoldkiwi','psoursop','pcashew','suizenjina','vegshishigatanikabocha','vegkinjiso','naganegi','vegotakikabu','shironegi','koshizunegi','menegi','akatamanegi','jumbogarlic','shimarakkyo','wakegi','murasakininjin','nezumidaikon','karamidaikon','koshindaikon','salsify','tigernut','kuzuukon','peppercolor','pepperpadron','ootougan','beniokra','shimaokra','snapendou','soramame','neopyropiayezoensis','ulvapertusa','monostromanitidum','gloiopeltisfurcata','cladosiphonokamuranus','caulerpalentillifera','quercusglauca','castanopsissieboldii','machilusthunbergii','cleyerajaponica','chamaecyparispisifera','piceajezoensis','abiessachalinensis','prunusincisa','prunusyedoensis','juglansailanthifolia','prunussargentii','cornuskousa','kuroyuri','prunusitosakura','chishimagikyou','uruppusou','shinanokinbai2','hakusanfuuro','yotsubashiogama','tsurifuneso','fukujuso','ubayuri','denjiso','ryoumenshida','chinguruma','baobab','sequoia','rafflesia','quercusrobur','helianthus','nelumbo','bristleconepine','coastredwood','yoshinocherry','baobab2','ginkgo','dawnredwood','yamazakura','mizunara','japanesecedar','hinokicypress','japaneseredpine','silverbirch','japaneseelm','japanesehorsechestnut','olive','corkoak','japanesemaple','eucalyptus','flametree','dragonbloodtree','tulip','noibara','jacaranda','yamayuri','asagao','higanbana','seiyotanpopo','cosmos','chrysanthemum','katakuri','sakuraso','hinageshi','edelweiss','lavender','mizubasho','watasuge','rindo','poinsettia','phalaenopsis','shakunage','dendrobium','cypripedium','paphiopedilum','sarracenia','drosera','pinguicula','utricularia','saguaro','opuntia','aloevera','lithops','haworthia','agave','warabi','zenmai','hego','echeveria','tamashida','ryubintai','sugina','zenigoke','sotetsu','onisotetsu','welwitschia','koyamaki','nagi','himalayasugi','europeanbeech','camphortree','sumire','ajisai','tsutsuji','cattleya','cymbidium','venusflytrap','sagiso','goldenbarrel','hikagenokazura','gunetum','ichii','nanyousugi','karamatsu','shiran','kinran','ginran','sekkoku','fuuran','nagoran','nejibana','tokiso','sawaran','uchoran','oncidium','vanda','kumagaiso','saihairan','miltonia','masdevallia','dracula','stanhopea','pleurothallis','coryanthes','disauniflora','gekkabijin','benihashira','mammillaria','shakobasaboten','astrophytum','echinopsis','gymnocalycium','ferocactus','kidachialoe','conophytum','graptopetalum','sempervivum','hanakirin','kalanchoe','bottletree','haworthiopsis','cleistocactus','adenium','pachypodium','stapelia','cocospalm','datepalm','oilpalm','palmyra','crassulaovata','livistona','nipapalm','windmillpalm','canaryphoenix','rattanpalm','travelerstree','bananaplant','mangotree','papayatree','duriantree','mangosteen','jackfruit','rambutan','coffeearabica','teaplant','breadfruit','guavatree','avocadotree','lycheetree','longantree','tamarindtree','komakusa','miyamakinbai','hakusanichige','iwagikyo','kokemomo','gankouran','chonosukeso','shinanokinbai','miyamaodamaki','komausuyukiso','iwahige','aoikeshi','giantlobelia','puyaraimondii','broom','giantsenecio','tussockgrass','oxeyedaisy','heather','lupine','pasqueflower','hauchiwakaede','satokaede','itayakaede','norwaykaede','konara','kunugi','abemaki','kashiwa','akagashi','shirakashi','dakekanba','keyaki','enoki','mukunoki','yachidamo','europeanash','katsura','honoki','tuliptree','londonplane','kikyou','nemunoki','ominaeshi','fujibakama','yomena','harujion','himejoon','seitakaawadachisou','noazami','benibana','marigold','zinnia','dahlia','gerbera','murasakitsumekusa','shirotsumekusa','sweetpea','yamahagi','hanashoubu','nikkoukisuge','yabukanzou','kawaranadeshiko','ayame','kakitsubata','inomotoso','oshida','kujakushida','kanikusa','koshida','tachigoke','matsubaran','tokusa','omizugoke','jagoke','kuromatsu','goyomatsu','haimatsu','kometsuga','asunaro','kouhonespatterdock','hitsujigusapwl','onibasugiantll','hoteiaoiwh','ukikusaduckweed','matsumohornwort','kuromohydrilla','ebimopondweed','gamacattail','yoshicommonreed','mousouchikubamboo','madakebamboo','kumazasasbamboo','susukimisc','giantkelpmacro','zygopetalum','lycaste','brassavola','epidendrum','laeliaanceps','tokiwaran','nariyaran','mamezutaran','kumoran','neoregelia','usneoides','spathiphyllum','plumeria','ixoracoccinea','lantanacamara','heliconiarostrata','strelitziareginae','alpiniazerumbet','zingiberofficinale','curcumalonga','etlingeraelatior','cannaindica','codiaeumvariegatum','proteacynaroides','gloriosasuperba','victoriaamazonica','medinillamagnifica','yabutsubaki','kinmokusei','sazanka','hanamizuki','lilac','rengyo','nanakamado','karin','ichijiku','nezumimochi','monkeypod','illawarra','angraecum','sedumsieboldii','selenicereus','cacaotree','bluebell','whiteoak','hannoki','waremokou','benishida','kogomi','nokishinobu','junsaiwatershield','asazafringedwl','gagabutaflbt','makomowildrice','igusarush','papyrussedge','coelogynecristata','maxillaria','galeandra','rodriguezia','sakuraran','aechmea','anthurium','hibiscusrosa','bougainvillea','grevillearobusta','mussaendaphilippica','barringtoniaracemosa','kuchinashi','sarusuberi','yukiyanagi','zakuro','seiba','castaneacrenata','lithocarpusedulis','abiesfirma','tsugasieboldii','torreyanucifera','magnoliakobus','liquidambarformosana','styraxjaponicus','abiesveitchii','corylopsisspicata','cornuscontroversa','rhusjavanica','hoveniadulcis','firmianasimplex','broussonetiapapyrifera','diospyroskaki','citrusjunos','zanthoxylumpiperitum','weigelahortensis','euonymusalatus','viburnumdilatatum','rhododendronkaempferi','rhododendronjaponicum','rhododendronaureum','vacciniumsmallii','linderaobtusiloba','puerarialobata','anemoneflaccida','liliumspeciosum','liliumlancifolium','tricyrtishirta','paeonialactiflora','platantherasachalinensis','trilliumcamschatcense','calanthediscolor','arisaemaserratum','glaucidiumpalmatum','plataginaceaeveronica','belamcandachinensis','liriopemuscari','houttuyniacordata','reynoutriajaponica','cyrtomiumfalcatum','wasabiajaponica','saxifragafortunei','saxifragastolonifera','campanulapunctata','taraxacumjaponicum','adenophoratriphylla','sedumsarmentosum','loiseleuriaprocumbens','hydrangeahirta','actinidiaarguta','actinidiapolygama','sargassumfusiforme','undariapinnatifida','saccharinajaponica','pyropiayezoensis','codiumfragile','calystegiasoldanella','vitexrotundifolia','raphanussativuslongi','rosarugosa','aucubajaponica','skimmiajaponica','prunusmume','rhodotypostkirsioides','daphneodora','ostryajaponica','juglansailantifolia','sapindusmukorossi','salixbabylonica','achilleamillefolium','tanacetumvulgare','solidagocanadensis','arctiumlappa','carduusnutans','senecioviscosus','crepiscapillaris','antennariadioica','doronicumgrandiflorum','lathyruspratensis','oxytropiscampestris','medicagolupulina','anthyllisvulneraria','caltapalustris','aconitumnapellus','aquilegiavulgaris','helleborusniger','adonisvernalis','liliummartagon','convallariamajalis','galanthusnivalis','polygonatummultiflorum','narcissuspseudonarcissus','colchicumautumnale','nupharlutea','sagittariasagittifolia','butomusumbellatus','menyanthestrifoliata','lemnaminor','myriophyllumspicatum','potamogetonnatans','hottoniapalustris','gentianaverna','primulavulgaris','soldanellaalpina','saxifragaoppositifolia','saxifragapaniculata','sileneacaulis','silenedioica','eschscholziacalifornica','chelidoniummajus','linariavulgaris','veronicachamaedrys','verbascumthapsus','lamiumalbum','originumvulgare','stachyssylvatica','campanularotundifolia','jasionemontana','echiumvulgare','phyteumaorbiculare','myosotisscorpioides','symphytumofficinale','violaodorata','geraniumpratense','filipendulaulmaria','potentillaerecta','orchismascula','dactylorhizamaculata','leucojumvernum','allyumursinum','alliumschoenoprasum','asphodelusalbus','sedumacre','eriophorumangustifolium','ranunculusglacialis','geummontanum','valerianaofficinalis','angelicasylvestris','eupatoriumcannabinum','petasiteshybridus','lythrumsalicaria','hypericumperforatum','althaeaofficinalis','verbenaofficinalis','gentianapneumonanthe','alismaplantagoaquatica','acoruscalamus','trilliumgrandiflorum','asclepiastuberosa','aquilegiacanadensis','liatrisspicata','dodecatheonmeadia','gauratindheimeri','penstemondigitalis','scabiosacolumbaria','galiumverum','cardaminehirsuta','capsellabursapastoris','ranunculusrepens','campanulaglomerata','primulajaponica','rheumnobile','primuladenticulata','saussureaobvallata','oncidiumsphacelatum','phalaenopsisamabilis','cymbidiumtracyanum','phragmipediumbesseae','calanthetricarinata','diuriacorymbosa','thelymitracrinita','renantheraimschootiana','goodyerapubescens','gymnadeniaconopsea','cephalantheradamasonium','neottianidusavis','lophophorawilliamsii','cereusrepandus','pereskiaaculeata','selenicereusgrandiflorus','agavevictoriae','cleistocactusstrausii','aloeferox','aloepolyphylla','sedummorganianum','aloedichotoma','euphorbiatrigona','pachypodiumlamerei','droseracapensis','nepenthesrajah','sarraceniaflava','cephalotusfollicularis','pinguiculagrandiflora','byblisliniflora','darlingtoniacalifornica','osmundaregalis','heliamphoranutans','aldrovandavesiculosa','adiantumcapillusveneris','cyatheamedullaris','dicksoniaantarctica','blechnumspicant','woodwardiaradicans','polytrichumcommune','funariahygrometrica','thuidiumtamariscinum','cycascircinalis','encephalartoswoodii','zamiafurfuracea','boweniaserrulata','stangeriaeriopus','dendrobiumphalaenopsis','vandatricolor','cattleyamossiae','parodiamagnifica','agavetequilana','dracaenadraco','sarracenialeucophylla','pinguiculamoranensis','droserabinata','cyatheacooperi','angiopterisevecta','dicranumscoparium','encephalartoshorridus','cycaspanzhihuaensis','quercusilex','fagussylvatica','betulapendula','castaneasativa','alnusglutinosa','pinussylvestris','pinusponderosa','pinuspinea','piceaabies','abiesalba','larixdecidua','thujaplicata','cedruslibani','magnoliagrandiflora','eucalyptusglobulus','corymbiacitriodora','araucariaheterophylla','syzygiumaromaticum','shorearobusta','swieteniamacrophylla','dipterocarpusalatus','tectonagrandis','dalbergiamelanoxylon','baobabafricana','acaciatortilis','acaciasenegal','tabebuiarosea','handroanthuschrysanthus','bertholletiaexcelsa','cinnamomumverum','roystonearegia','washingtoniafilifera','ulmusamericana','platanusoccidentalis','tiliaamericana','populustremuloides','juglansnigra','malusdomestica','sorbusaucuparia','crataegusmonogyna','ficusreligiosa','morusalba','rhododendronarboreum','agathisaustralis','protearepens','podocarpustotara','pandanustectorius','cupressussempervirens','avicenniamarina','barringtoniaasiatica','pinuscontorta','pseudotsugamenziesii','piceamariana','acernegundo','quercuscoccinea','nyssasylvatica','robiniapseudoacacia','gleditsiatriacanthos','cerciscanadensis','acersaccharinum','acerginnala','arbutusunedo','ilexaquifolium','ceratoniasiliqua','acaciaerioloba','sclerocaryabirrea','spathodeacampanulata','xanthorrhoeaaustralis','commiphoramyrrha','oleaeuropaeacuspidata','podocarpusmacrophyllus','prunusdulcis','nothofaguscunninghamii','pinushalepensis','hopeaodorata','santalumalbum','haematoxylumcampechianum','aquilariamalaccensis','caesalpiniaechinata','hymenaeacourbaril','euterpeoleracea','mauritiaflexuosa','cariniananparvifolia','heveabrasiliensis','manilkarazapota','yuccabrevifolia','parkinsoniaflorida','fouquieriacolumnaris','prosopisglandulosa','acaciaaneura','cassiafistula','buteamonosperma','azadirachtaindica','moringaoleifera','baobabza','erythrophleumsuaveolens','milletiaaurea','entandrophragmacylindricum','miliciaexcelsa','pericopsiselata','guaiacumofficinale','pinuscembra','sorbustorminalis','acercampestre','viburnumopulus','euonymuseuropaeus'],
  無脊椎:['chosenhamaguri','honbinosugai','kagamigai','mashijimi','hiougigai','midoriigai','igai','haigai','shiofuki','torigai','agemaki','akoyagai','sugai','himeezobora','ecchubai','bateira','kubogai','kisago','nagatanishi','ootanishi','kouraiebi','hokkokuakaebi','botanebi','benizuwaigani','aburagani','ishigani','chuugokumokuzugani','hiratsumegani','kurigani','togekurigani','murasakiuni','toyamaebi','yariika','ezobafununi','kitamurasakiuni','kumaebi','yoshiebi','saruebi','akaebi','shiraebi','nishikiebi','hakoebi','oobauchiwaebi','anajako','minamitenagaebi','hiratetenagaebi','togenokogirigazami','oozuwaigani','hokkaiebi','ibaramoebi','futomizoebi','akatenokogirigazami','higenagaebi','ookoshioriebi','danbeikisago','zouriebi','redcherryshrimp','leiobunummanubriatum','oxidusgracilis','triopslongicaudatus','meghimatiumbilineatum','daphniapulex','acustadespecta','crassostreanippona','pseudocardiumsachalinense','atrinapectinata','neptuneapolycostata','eiseniafetida','anadarabroughtonii','kurumaebi2','madako','mizukurage','sazae','octopus','nautilus','spidercrab','americanlobster','commoncuttlefish','emperorscorpion','mexicanredknee','coconutcrab','moonjelly','giantisopod','horseshoecrab','giantclam','fireflysquid','crownofthorns','vampiresquid','bluestarfish','mantisshrimp','portugueseman','argiope','cornuaspersum','lissachatina','spanishdancer','goliathbirdeater','cobaltbluetarantula','jorospider','argiopespider','jumpingspider','huntsmanspider','bolasspider','sydneyfunnelweb','deathstalker','redheadcentipede','blackwidow','peruviangiantcentipede','giantafricanmillipede','yaeyamamillipede','atlantichorseshoecrab','taillesswhipscorpion','vinegaroon','tarabagani','kegani','zuwaigani','gazami','nokogirigazami','sawagani','mokuzugani','iseebi','europeanlobster','kurumaebi','tenagaebi','sujiebi','otohimeebi','shako','commonoctopus','dumboflapjack','blanketoctopus','blueringedoctopus','coconutoctopus','bigfinreefsquid','cuttlefish','giantsquid','diamondbacksquid','argonaut','colossalsquid','cowrie','tritonstrumpet','manilaclam','turbansnail','abalone','bluedragonnudibranch','mahitode','kobuhitode','seaangel','takonomakura','gangaze','nisekuronamako','akakurage','takokurage','habukurage','benikurage','sakasakurage','owankurage','umeboshiisoginchaku','hatagoisoginchaku','brownrecluse','sunagani','tezurumozuru','bafununi','amefurashi','ibarakanzashi','umikemushi','yumushi','hoshimushi','maboya','sarupa','hikariboya','urikurage','mokuyokukaimen','fusenkurage','hokimushi','haorimushi','kokemushi','udefuritsunozaya','konpeitouminushi','aominouminushi','minouminushi','hyoumonuminushi','kuroshitanashi','kiirouminushi','gokurakumidorigai','trapania','umifukurou','kuroheriamefurashi','tatsunamigai','budougai','zougeirouminushi','saysneedragon','akabosometeriri','cinderellaumiushi','nishikiuminushi','sakateriumiushi','ambonoimogai','tagayasanminashi','bekkouimo','hachijoudakara','boushuubora','tokobushi','nishikiuzu','suishougai','kumasakagai','suijigai','shokkoura','kumogai','harushagai','itayagai','akkigai','honegai','magaki','hamaguri','misujimaimai','ringomaimai','hamadenderamushi','sazaeturban','akoyamodoki','akategani','iwagani','isogani','hanasakigani','ibaragani','asahigani','heikegani','subesubemanju','sodekarappa','torafushako','ashinagamoenikaragani','edamidoriishi','tablecoral','kikumeishi','nousango','hamasango','azamisango','ootabasango','umiazami','senjuisoginchaku','tamaitadaki','echizenkurage','kusabiraishi','bizenkurage','andonkurage','manjuhitode','yatsudehitode','itomakihitode','momijigai','rappauni','tawashiuni','akauni','nagauni','nihonzarigani','uchidazarigani','americanzarigani','marronzarigani','yamatonumaebi','redbeeshrimp','togenashinumaebi','yabbyzarigani','akazaebi','beniwamonyadokari','warajimushi','okadangomushi','funamushi','tarumawashi','yokoebi','copepod','yanagidako','fujitsubo','iidako','tenagadako','juumonjidako','mimicocto','torafukouika','kobushime','kaminariika','kensakiika','akaika','surumeika','dangoika','himeika','mimiika','spirula','oobesonautilus','bigfinsquid','telescopeocto','wonderpus','onigumo','jigumo','kimuragumo','hanagumo','madarasasori','azuchigumo','nihonhiratazatomushi','akagaminegumo','chuugakushigumo','yagatesashigumo','hosohariganazatomushi','crownofthornssunstar','bloodseastar','slatepencilurchinheo','seaapplecucumber','tigertailcucumber','redseasquirt','seapeach','barrelsponge','lionsmanejelly','uminina','kawanina','marutanishi','sakamakigai','karasugai','bakagai','mategai','uchimurasaki','kiserugai','okamonoaragai','yamanamekuji','chakouranamekuji','benkeigani','sangoyadokari','sakuraebi','wamondako','kabeanatakaradani','luidiastarfish','hearturchinbrissus','lugworm','featherdusterworm','akanishi','ibonishi','reishigai','dobugai','himetanishi','monoaragai','carcinusmaenas','cancerpagurus','ucapugnax','callinectessapidus','grapsusgrapsus','maenuscoenobita','jasuslalandii','litopenaeusvannamei','penaeusmonodon','lysmataamboinensis','squillamantis','hapalochlaenalunulata','emeritaanaloga','lepasanatifera','metasepiapfefferi','strombusgigas','haliotisrufescens','mytilusedulis','dosidicusgigas','cepaeanemoralis','pectenmaximus','crassostreagigas','chromodorisannae','flabellinaiodinea','hypselodoriscarmosus','nephilapilipes','latrodectushasselti','aplysiacalifornica','elysiachlorotica','phidippusaudax','argiopeaurantia','androctonusaustralis','hadrurusarizonensis','chironexfleckeri','chrysaoraplocamia','metridiumsenile','acroporamillepora','chrysaorafuscescens','coralliumrubrum','pocilloporadamicornis','asteriasrubens','strongylocentrotuspurpuratus','pisasterochraceus','echinusesculentus','heliofungiaactiniformis','apostichopusjaponicus','holothuriaforskali','sabellapavonina','hirudomedicinalis','lumbricusterrestris','antedonbifida','aplysinaarcheri','velellavelella','ophiothrixfragilis','carcinoscorpiusrotundicauda','clibanariustricolor','galatheastrigosa','rhynchocinetesdurbanensis','hymenoceraelegans','nephropsnorvegicus','cheraxquadricarinatus','astacusastacus','daphniamagna','scyllarideslatus','grimpoteuthisbathynectes','loligovulgaris','nucellalapillus','patellavulgata','littorinalittorea','sepiolaatlantica','discodorispardalis','anthopleuraxanthogrammica','condylactisgigantea','craspedacustasowerbii','heliasterhelianthus','echinasterspinulosus','thelenotaananas','cucumariafrondosa','aphroditeaculeata','eunicaphroditois','dendrogaster','liocarcinusvernalis','inachusphalangium','munidarugosa','munidopsis','velutinavelutina','chromodorisquadricolor','pelagianoctiluca','phacellophoracamtschatica','dorispseudoargus','melibeleonina','cassiopeaxamachana','aequoreavictoria','xestospongiamuta','euplectellaaspergillum','gasteracanthacancriformis','misumenavatia','dolomedesfimbriatus','galeodesarabs','opisthacanthus','lithobiusforficatus','colossendeismegalonyx','hypsibiusdujardini','antarctickrill','paralomisbirsteini','asellusaquaticus','ligiaoceanica','sepiabandensis','taoniusborealis','teredonavalis','limalima','spondylusvarians','argopectenirradians','hippopushippopus','ensismagnus','pholasdactylus','janthinajanthina','arionater','japanesescallop','w7crabsflower','w7crabschristmasred','w7crabsghost','w7crabsvelvet','w7crabsstone','w7crabssallylightfoot','w7crabspeatoad','w7crabsboxer','w7crabsyeti','w7lobstercaribbean','w7lobsterslipper','w7shrimpgiantriver','w7squidcaribbeanreef','w7snailleafsheep','w7clamocean','w7hermitred','w7clamgeoduck','w7hermitland','w7urchinred','w7seacucumbersandfish','w7spiderbrazilianwander','w7spidergoldenorb','w7spiderwolf','w7spidermexicanred','w7scorpionarizonabark','w7spiderorbgarden','w7scorpiongiantforest','w7coralstaghorn','w7coralfire','w7octopusatlanticpygmy','w7crabsargassum','w7spidernursery','w7seacucumbertiger','w7crablandpurple','w7lobsterslippersculptured','w7snailcerith','w7crabsheep','w7crabsvampiretiny','w7shrimpspottedcleaner','w7coralbubble','w7jellyfishcannonball','w7crabsvelvetswimming','w7snailflamingotongue','w7crabsleopard','w7crabspongdecorator','w7jellyfishcompass','w7seastarpincushion','w7crabsboxingtiny','w7seacucumberblack','w7starfishegyptian','w7shrimpbumblebee','w7urchinheart','w7spiderfishing','w7crabsvelvethairy'],
};
const clsOrder=['哺乳類','鳥類','爬虫類','両生類','魚類','昆虫','植物','菌類','無脊椎'];
function classOf(a){ for(const k in CLASS){ if(CLASS[k].includes(a.id)) return k; } return '哺乳類'; }
// 生息数文字列をおおよその数値へ（ソート用）。範囲は上限・万/億・あいまい表現も解釈。不明は-1で末尾。
function popNum(a){
  let s=popOf(a); if(!s||/データ不足|不明/.test(s)) return -1;
  s=s.replace(/,/g,'');
  const re=/([0-9]+(?:\.[0-9]+)?)\s*(億|万)?/g, mult={'億':1e8,'万':1e4}; let m,best=-1;
  while((m=re.exec(s))){ let v=parseFloat(m[1]); if(m[2])v*=mult[m[2]]; if(v>best)best=v; }
  if(best>=0) return best;
  const vague=[['数千万',5e7],['数百万',5e6],['数十万',5e5],['数万',5e4],['数千',5e3]];
  for(const [k,v] of vague){ if(s.includes(k)) return v; }
  if(/豊富/.test(s)) return 1e7;
  if(/安定/.test(s)) return 1e5;
  return -1;
}
const BIOMES = {
  'サバンナ':{e:'🌾', g:['#caa24a','#7a5a1e']},
  '森林':    {e:'🌲', g:['#3f9d6b','#1c4a33']},
  '熱帯雨林':{e:'🌴', g:['#2fae6b','#0f3d28']},
  '草原':    {e:'🌿', g:['#a8b85a','#5a6a28']},
  '寒帯林':  {e:'🌲', g:['#4a8fb3','#1c3a4a']},
  '高山':    {e:'🏔️', g:['#8aa0c2','#3a4a66']},
  '乾燥地':  {e:'🏜️', g:['#d08a4a','#6e3a1e']},
  '湿地':    {e:'🪷', g:['#4aa98f','#1c4a44']},
  '海':      {e:'🌊', g:['#2f8fd0','#0e3a5a']},
  '極地':    {e:'❄️', g:['#9fd2ec','#3a6a86']},
};
const CC = {
  KEN:['ケニア','🇰🇪'],TZA:['タンザニア','🇹🇿'],ZAF:['南アフリカ','🇿🇦'],BWA:['ボツワナ','🇧🇼'],
  ZMB:['ザンビア','🇿🇲'],ZWE:['ジンバブエ','🇿🇼'],NAM:['ナミビア','🇳🇦'],MOZ:['モザンビーク','🇲🇿'],
  AGO:['アンゴラ','🇦🇴'],ETH:['エチオピア','🇪🇹'],SSD:['南スーダン','🇸🇸'],IND:['インド','🇮🇳'],
  COD:['コンゴ民主共和国','🇨🇩'],COG:['コンゴ共和国','🇨🇬'],GAB:['ガボン','🇬🇦'],CMR:['カメルーン','🇨🇲'],
  GNQ:['赤道ギニア','🇬🇶'],CAF:['中央アフリカ','🇨🇫'],CAN:['カナダ','🇨🇦'],RUS:['ロシア','🇷🇺'],
  GRL:['グリーンランド','🇬🇱'],NOR:['ノルウェー','🇳🇴'],USA:['アメリカ','🇺🇸'],ATA:['南極大陸','🇦🇶'],
  AUS:['オーストラリア','🇦🇺'],CHN:['中国','🇨🇳'],BGD:['バングラデシュ','🇧🇩'],NPL:['ネパール','🇳🇵'],
  BTN:['ブータン','🇧🇹'],THA:['タイ','🇹🇭'],MMR:['ミャンマー','🇲🇲'],MYS:['マレーシア','🇲🇾'],
  IDN:['インドネシア','🇮🇩'],MNG:['モンゴル','🇲🇳'],KAZ:['カザフスタン','🇰🇿'],FIN:['フィンランド','🇫🇮'],
  SWE:['スウェーデン','🇸🇪'],POL:['ポーランド','🇵🇱'],BRA:['ブラジル','🇧🇷'],PER:['ペルー','🇵🇪'],
  COL:['コロンビア','🇨🇴'],VEN:['ベネズエラ','🇻🇪'],BOL:['ボリビア','🇧🇴'],MEX:['メキシコ','🇲🇽'],
  ARG:['アルゼンチン','🇦🇷'],PRY:['パラグアイ','🇵🇾'],ECU:['エクアドル','🇪🇨'],PAK:['パキスタン','🇵🇰'],
  AFG:['アフガニスタン','🇦🇫'],KGZ:['キルギス','🇰🇬'],TJK:['タジキスタン','🇹🇯'],
  UGA:['ウガンダ','🇺🇬'],TCD:['チャド','🇹🇩'],IRN:['イラン','🇮🇷'],CHL:['チリ','🇨🇱'],
  JPN:['日本','🇯🇵'],NZL:['ニュージーランド','🇳🇿'],ISL:['アイスランド','🇮🇸'],KOR:['韓国','🇰🇷'],
  MWI:['マラウイ','🇲🇼'],ISR:['イスラエル','🇮🇱'],LKA:['スリランカ','🇱🇰'],KHM:['カンボジア','🇰🇭'],
  EST:['エストニア','🇪🇪'],UKR:['ウクライナ','🇺🇦'],DNK:['デンマーク','🇩🇰'],BEL:['ベルギー','🇧🇪'],
  DEU:['ドイツ','🇩🇪'],LUX:['ルクセンブルク','🇱🇺'],URY:['ウルグアイ','🇺🇾'],CRI:['コスタリカ','🇨🇷'],
  PAN:['パナマ','🇵🇦'],NIC:['ニカラグア','🇳🇮'],ESP:['スペイン','🇪🇸'],PRT:['ポルトガル','🇵🇹'],
  ARE:['アラブ首長国連邦','🇦🇪'],ITA:['イタリア','🇮🇹'],GRC:['ギリシャ','🇬🇷'],NLD:['オランダ','🇳🇱'],
  TUR:['トルコ','🇹🇷'],PHL:['フィリピン','🇵🇭'],ATF:['仏領南方・南極','🇹🇫'],GBR:['イギリス','🇬🇧'],
  FLK:['フォークランド諸島','🇫🇰'],CHE:['スイス','🇨🇭'],ROU:['ルーマニア','🇷🇴'],
  DZA:['アルジェリア','🇩🇿'],TUN:['チュニジア','🇹🇳'],MDG:['マダガスカル','🇲🇬'],EGY:['エジプト','🇪🇬'],
  MAR:['モロッコ','🇲🇦'],MRT:['モーリタニア','🇲🇷'],SAH:['西サハラ','🇪🇭'],SAU:['サウジアラビア','🇸🇦'],
  OMN:['オマーン','🇴🇲'],VNM:['ベトナム','🇻🇳'],GIN:['ギニア','🇬🇳'],LBR:['リベリア','🇱🇷'],SWZ:['エスワティニ','🇸🇿'],
  NCL:['ニューカレドニア','🇳🇨'],PNG:['パプアニューギニア','🇵🇬'],VUT:['バヌアツ','🇻🇺'],
  FRA:['フランス','🇫🇷'], TWN:['台湾','🇹🇼'], NGA:['ナイジェリア','🇳🇬'], SEN:['セネガル','🇸🇳'], GUY:['ガイアナ','🇬🇾'], GTM:['グアテマラ','🇬🇹'], LAO:['ラオス','🇱🇦'], CUB:['キューバ','🇨🇺'], MDV:['モルディブ','🇲🇻'], GHA:['ガーナ','🇬🇭'], SDN:['スーダン','🇸🇩'], BHS:['バハマ','🇧🇸'], HND:['ホンジュラス','🇭🇳'], AUT:['オーストリア','🇦🇹'], BRN:['ブルネイ','🇧🇳'], SUR:['スリナム','🇸🇷'], HAW:['ハワイ','🌺'], FJI:['フィジー','🇫🇯'], HUN:['ハンガリー','🇭🇺'], PLW:['パラオ','🇵🇼'], IRL:['アイルランド','🇮🇪'], SOM:['ソマリア','🇸🇴'], SGP:['シンガポール','🇸🇬'], CIV:['コートジボワール','🇨🇮'], MLI:['マリ','🇲🇱'], BLZ:['ベリーズ','🇧🇿'], HRV:['クロアチア','🇭🇷'], TTO:['トリニダード・トバゴ','🇹🇹'], PYF:['仏領ポリネシア','🇵🇫'], JAM:['ジャマイカ','🇯🇲'], TKM:['トルクメニスタン','🇹🇲'], GUF:['仏領ギアナ','🇬🇫'], SYC:['セーシェル','🇸🇨'], YEM:['イエメン','🇾🇪'], IRQ:['イラク','🇮🇶'], LBY:['リビア','🇱🇾'], SLB:['ソロモン諸島','🇸🇧'], LSO:['レソト','🇱🇸'], SVN:['スロベニア','🇸🇮'], UZB:['ウズベキスタン','🇺🇿'], SYR:['シリア','🇸🇾'], ERI:['エリトリア','🇪🇷'], BDI:['ブルンジ','🇧🇮'], BGR:['ブルガリア','🇧🇬'], PRI:['プエルトリコ','🇵🇷'], BEN:['ベナン','🇧🇯'], MUS:['モーリシャス','🇲🇺'], RWA:['ルワンダ','🇷🇼'], NER:['ニジェール','🇳🇪'], TLS:['東ティモール','🇹🇱'], DOM:['ドミニカ共和国','🇩🇴'], GEO:['ジョージア','🇬🇪'], TGO:['トーゴ','🇹🇬'], CPV:['カーボベルデ','🇨🇻'], HKG:['香港','🇭🇰'], CYM:['ケイマン諸島','🇰🇾'], CZE:['チェコ','🇨🇿'], AZE:['アゼルバイジャン','🇦🇿'], BRB:['バルバドス','🇧🇧'], HTI:['ハイチ','🇭🇹'], SLE:['シエラレオネ','🇸🇱'], PRK:['北朝鮮','🇰🇵'], ALB:['アルバニア','🇦🇱'], GLP:['グアドループ','🇬🇵'], MTQ:['マルティニーク','🇲🇶'], DMA:['ドミニカ国','🇩🇲'], COM:['コモロ','🇰🇲'], FRO:['フェロー諸島','🇫🇴'], DJI:['ジブチ','🇩🇯'], VIR:['米領ヴァージン諸島','🇻🇮'], AND:['アンドラ','🇦🇩'], GMB:['ガンビア','🇬🇲'], BLR:['ベラルーシ','🇧🇾'], MHL:['マーシャル諸島','🇲🇭'], SLV:['エルサルバドル','🇸🇻'], SRB:['セルビア','🇷🇸'], LCA:['セントルシア','🇱🇨'], ARM:['アルメニア','🇦🇲'], CYP:['キプロス','🇨🇾'], JOR:['ヨルダン','🇯🇴'], MLT:['マルタ','🇲🇹'], CXR:['クリスマス島','🇨🇽'], SPM:['サンピエール・ミクロン','🇵🇲'], KIR:['キリバス','🇰🇮'], WSM:['サモア','🇼🇸'], SVK:['スロバキア','🇸🇰'], GIB:['ジブラルタル','🇬🇮'], GNB:['ギニアビサウ','🇬🇼'], ESH:['西サハラ','🇪🇭'], TON:['トンガ','🇹🇴'], BIH:['ボスニア・ヘルツェゴビナ','🇧🇦'], CUW:['キュラソー','🇨🇼'], ABW:['アルバ','🇦🇼'], LBN:['レバノン','🇱🇧'], GUM:['グアム','🇬🇺'], FSM:['ミクロネシア連邦','🇫🇲'], VCT:['セントビンセント','🇻🇨'], GRD:['グレナダ','🇬🇩'], AFR:['アフリカ','🌍'], MNE:['モンテネグロ','🇲🇪']

};
const ccName=(c)=>CC[c]?CC[c][0]:c;
const ccFlag=(c)=>CC[c]?CC[c][1]:'📍';

/* ---------- シードデータ（28種）---------- */
let ANIMALS = [];
// 種データは data/species-core.json（軽量コア）を非同期ロード（地図はこれを待たずに即初期化）。詳細は下記 ensureDetail() で遅延ロード。
// ※fetch を使うため file:// 直開きは不可＝HTTP配信（GitHub Pages / localhost）が前提。
let __speciesDone; const __speciesReady = new Promise(r=>{ __speciesDone = r; });
// 初回はコア（一覧/地図/検索に要る軽い項目）だけ読み込む。カードでだけ要る詳細(stats/desc/photoCred)は
// species-detail.json に分離し、種カードを開いた時に ensureDetail() で初回だけ遅延ロードする（scripts/generate.mjs が両ファイルを生成）。
const __spData = fetch('data/species-core.json').then(r=>{ if(!r.ok) throw new Error('species-core.json '+r.status); return r.json(); });

/* 写真クレジット（Wikimedia Commons API から取得した撮影者・ライセンス）。出典明記=ライセンス遵守 */
let PHOTO_CRED = {};
// 写真URLの短縮復元：core は容量削減のため写真URLをコンパクト表記("1|w|ab|file"等)で持つ。
// ロード時に photoURL() で本来の Wikimedia URL に戻す（scripts/generate.mjs の compactPhoto と対）。
function photoURL(p){
  if(typeof p!=='string') return p||'';
  const t=p.split('|'); const P='https://upload.wikimedia.org/wikipedia/commons/';
  if(t[0]==='9') return p.slice(2);                                   // 9|<フルURL>（非Commons等はそのまま）
  if(t[0]==='1'){ const w=t[1],ab=t[2],f=t[3]; return P+'thumb/'+ab[0]+'/'+ab+'/'+f+'/'+w+'px-'+f; } // thumb
  if(t[0]==='0'){ const ab=t[1],f=t[2]; return P+ab[0]+'/'+ab+'/'+f; }                               // 直リンク
  return p;                                                           // 未知＝そのまま（後方互換）
}
// 復元済みフルURL(a.photo)から小サムネURLを作る。小さいアイコン(世界の浮遊アイコン等)で原寸/960px画像を丸ごと読まないため。
// thumb URLは幅を差し替え、直リンク原寸(Commons)はthumb経路へ組み替え、SVG/非Commonsはそのまま。
/* Wikimedia は任意幅のサムネを作ってくれない。許可サイズ以外を要求すると HTTP 400 を返し、
   ブラウザは画像として拒否する（Chrome では net::ERR_BLOCKED_BY_ORB）＝写真が黙って出なくなる。
   実測で 200 を返すのは下記のみ（96px・160px・320px などは全滅）。要求幅以上で最小のものに丸める。 */
const WM_THUMB_SIZES=[120,250,500,960,1280,1920];
function wmThumbSize(w){ for(const s of WM_THUMB_SIZES) if(s>=w) return s; return WM_THUMB_SIZES[WM_THUMB_SIZES.length-1]; }
function thumbURL(u, w){
  if(typeof u!=='string' || !u) return u||''; w=wmThumbSize(w||120);
  const T='/wikipedia/commons/thumb/', C='/wikipedia/commons/';
  if(u.indexOf(T)>=0) return u.replace(/\/(\d+)px-([^/]+)$/, '/'+w+'px-$2');   // 既にthumb＝幅だけ差し替え
  const ci=u.indexOf(C);
  if(ci>=0 && !/\.svg$/i.test(u)){                                             // 直リンク原寸→thumb化（Commonsは動的生成）
    const rest=u.slice(ci+C.length), parts=rest.split('/'), f=parts[parts.length-1];
    if(parts.length===3 && f) return u.slice(0,ci)+T+rest+'/'+w+'px-'+f;
  }
  return u;                                                                    // 非Commons/SVG/未知＝そのまま
}
// 出典URLヘルパー（写真＝Commonsファイルページ / 保全状況=IUCN / 観測=GBIF種ページ）
function commonsFile(url){ let m=url.match(/commons\/thumb\/[^/]+\/[^/]+\/([^/]+)\//)||url.match(/commons\/[^/]+\/[^/]+\/([^/?]+)$/); return m?m[1]:null; }
function commonsPageURL(url){ const f=commonsFile(url); return f?('https://commons.wikimedia.org/wiki/File:'+f):'https://commons.wikimedia.org/'; }
function iucnURL(a){ return 'https://www.iucnredlist.org/search?query='+encodeURIComponent(a.nameSci)+'&searchType=species'; }
function gbifURL(a){ return 'https://www.gbif.org/species/'+a.gbif; }

/* ---------- データ層インターフェース（seam）---------- */
const MockDataSource = {
  listAnimals: async()=>ANIMALS,
  getAnimal: async(id)=>ANIMALS.find(a=>a.id===id),
  getAnimalsByCountry: async(iso)=>ANIMALS.filter(a=>a.range.includes(iso)),
  getAnimalsByBiome: async(b)=>ANIMALS.filter(a=>a.biome===b),
};
const DATA = MockDataSource;   // ← 将来：GbifDataSource 等に差し替え

/* GBIF basisOfRecord（記録の種別）の共通条件。
   陸の生きものは人の目撃(HUMAN_OBSERVATION)だけで十分な密度があり、標本ノイズも避けられる＝従来どおり。
   一方 魚は人の目撃が極端に乏しい。図鑑収録魚90種の実測で HUMAN だけだと 6.7%がメッシュ完全に空・15.6%が50件未満
   （ブリ=6件／ハタハタ=16件。鳥・哺乳は空0%）。そこで魚だけ標本・調査記録まで採用する＝WILD。
   GBIFに「除外」パラメータは無いので採用する値を列挙してORにする（v1 search / v2 map density とも複数指定可）。
   落とすのは FOSSIL_SPECIMEN（化石＝現生でない）／LIVING_SPECIMEN（動物園・栽培＝その土地の野生分布でない）／
   MATERIAL_CITATION（実測すると PBDB＝古生物データベース由来の化石文献が大半）。 */
const GBIF_WILD_BASIS=['HUMAN_OBSERVATION','MACHINE_OBSERVATION','OBSERVATION','PRESERVED_SPECIMEN','MATERIAL_SAMPLE','OCCURRENCE'];
const GBIF_WILD_Q=GBIF_WILD_BASIS.map(b=>'&basisOfRecord='+b).join('');
const GBIF_HUMAN_Q='&basisOfRecord=HUMAN_OBSERVATION';
function gbifBasisQ(wide){ return wide?GBIF_WILD_Q:GBIF_HUMAN_Q; }
// 図鑑種が「魚」か＝メッシュ/観測点を WILD で引くか。近くモードのマーカー・一覧と basis を揃えて
// 魚の過少表示（人の目撃だけだと空/極薄）を緩和する。※期間はメッシュ=全期間・マーカー=直近10年で
// 元から別（「アイコン位置≠メッシュ」は既定の仕様）なので、母集団が完全に一致するわけではない。
function isWideBasis(a){ return !!a && clsOf(a)==='魚類'; }

/* 実データ層（GBIF）：学名→taxonKeyは取得済み。
   観測密度タイル（ヘックスビン）を重ねる。ヘックスはズーム階層ごとに再計算され、
   寄るほど細かいビンになる＝国全体ベタ塗りではない「詳細分布」。 */
function gbifTileURL(taxonKey, year, wide){
  return 'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png'
       + '?srs=EPSG:3857&taxonKey=' + taxonKey
       + '&bin=hex&hexPerTile=71&style=classic-noborder.poly'
       + gbifBasisQ(wide)                      // 陸=人の目撃のみ／魚=標本・調査記録も（化石は除外）
       + (year ? ('&year=' + year) : '');      // 時系列スライダー：年代で観測を絞る
}

/* ===================================================================== */
const $=(s)=>document.querySelector(s);
// 外部API文字列(GBIF種名/iNat和名・帰属/写真URL等)を innerHTML に補間する前のエスケープ。
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
// インラインonclick等に学名を埋める用：学名として妥当な文字だけ許可（引用符/不等号/バックスラッシュを排除＝注入不可）。
function sciKey(s){ return String(s==null?'':s).replace(/[^A-Za-z0-9 .×·'\-]/g,'').replace(/'/g,''); }
let CODE_PROP='ADM0_A3', countryGeo=null, mapReady=false, spinning=true, A3toA2={};
let gbifOn=false, currentAnimal=null, currentMode={type:'overview'};   // 分布メッシュ(GBIF実観測)は既定OFF＝第一印象は「きれいな地図＋生息地＋カード」。カード内トグルでopt-in（docs/design/11）
let atlasOn=false;   // アトラス表示（地形relief）のON/OFF。スタイルは入れ替えず重畳トグル
let dist3D=false;    // 分布の3D（立体）表示。GBIF MVTヘックス＋fill-extrusion（試験的）
const YEARBAR_ON=false;   // シンプル化②：🕰️年代スライダー(観測年代スクラブ)はUIから外す＝マニア機能（docs/design/11-A）。コード/データは残置＝復活は true に
// 低モーション/通信節約：自動回転を止めて電力・CPU・通信を節約（モバイル配慮＋アクセシビリティ）
const LOW_MOTION=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||!!(navigator.connection&&navigator.connection.saveData);
const SEEN = new Set(JSON.parse(localStorage.getItem('biosphere_seen')||'[]'));
const BADGES = new Set(JSON.parse(localStorage.getItem('biosphere_badges')||'[]'));   // 達成済みのコンプ演出（再表示しない）
// ===== Myずかん（USER層）：Stage1a=localStorageのみ。将来ここをSupabaseへ差し替える（seam・docs/design/05）=====
// 既存 SEEN（図鑑で"発見"した種）とは別レイヤー＝現実で「👀見た！」した記録（sightings）。
const USER = (()=>{
  const LS='biosphere_sightings';
  let list; try{ list=JSON.parse(localStorage.getItem(LS)||'[]'); }catch(e){ list=[]; }
  if(!Array.isArray(list)) list=[];
  const save=()=>{ try{ localStorage.setItem(LS,JSON.stringify(list)); return true; }catch(e){ return false; } };
  const dayKey=t=>{ const d=new Date(t); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
  return {
    all(){ return list; },
    recent(n){ return list.slice(-(n||30)).reverse(); },
    add(rec){ list.push(rec);
      if(save()) return {ok:true, photoDropped:false};
      if(rec.photo){ rec.photo=null; if(rec.confidence==='photo') rec.confidence='sure';   // 容量超過→写真を捨てて再保存
        if(save()) return {ok:true, photoDropped:true}; }
      list.pop(); return {ok:false, photoDropped:false};   // それでも保存不可＝in-memoryと永続の乖離を防ぐため巻き戻し
    },
    hasSeen(id){ return list.some(s=>s.id===id); },
    seenCount(id){ return list.reduce((n,s)=>n+(s.id===id?1:0),0); },
    speciesCount(){ return new Set(list.map(s=>s.id)).size; },
    xp(){ const seen=new Set(); let x=0; for(const s of list){ x+=seen.has(s.id)?5:50; if(s.photo)x+=10; seen.add(s.id); } return x; },
    level(){ return Math.floor(Math.sqrt(this.xp()/50))+1; },
    streak(){ if(!list.length)return 0; const days=new Set(list.map(s=>dayKey(s.at)));
      const d=new Date(); if(!days.has(dayKey(d.getTime()))) d.setDate(d.getDate()-1);   // 今日ぶんは猶予（昨日から数える）
      let n=0; while(days.has(dayKey(d.getTime()))){ n++; d.setDate(d.getDate()-1); } return n; },
  };
})();
// 画像を縮小して dataURL 化（localStorage節約）。将来は Supabase Storage へ。
function downscalePhoto(file, max){
  return new Promise((res)=>{ const fr=new FileReader();
    fr.onload=()=>{ const img=new Image();
      img.onload=()=>{ const s=Math.min(1,(max||420)/Math.max(img.width,img.height));
        const c=document.createElement('canvas'); c.width=Math.round(img.width*s)||1; c.height=Math.round(img.height*s)||1;
        try{ c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.72)); }catch(e){ res(null); } };
      img.onerror=()=>res(null); img.src=fr.result; };
    fr.onerror=()=>res(null); fr.readAsDataURL(file); });
}
function seenBtnLabel(id){ return USER.hasSeen(id) ? `✅ 見た！（${USER.seenCount(id)}回）・もう一度記録` : '👀 見た！ ずかんに登録'; }
function updateSeenBtn(id){ const b=document.getElementById('seenBtn'); if(b) b.innerHTML=seenBtnLabel(id); }
// 「👀見た！」記録モーダル（自己申告/写真の両対応・docs/design/02）
function openSeen(id){
  const a=ANIMALS.find(x=>x.id===id); if(!a)return; closeSeen();
  const m=document.createElement('div'); m.className='modal'; m.id='seenModal'; m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true');
  m.innerHTML=`<div class="modal-bg" onclick="closeSeen()"></div>
    <div class="modal-card seen-card">
      <button class="pclose" onclick="closeSeen()" aria-label="閉じる">✕</button>
      <h2>👀 見た！を記録</h2>
      <div class="seen-sp"><span class="seen-em">${a.emoji}</span><div><b>${esc(a.nameJa)}</b><span class="seen-sci">${esc(a.nameSci)}</span></div></div>
      <label class="seen-lb" for="seenNote">ひとことメモ（任意）</label>
      <input id="seenNote" class="seen-in" type="text" maxlength="80" placeholder="どこで・どんな様子だった？">
      <label class="seen-lb" for="seenPhoto">写真（任意・つけると＋ボーナス）</label>
      <input id="seenPhoto" class="seen-file" type="file" accept="image/*" onchange="seenPreview(this)">
      <div id="seenPrev" class="seen-prev" hidden><img alt=""></div>
      <label class="seen-chk"><input id="seenMaybe" type="checkbox"> 自信なし（たぶん）で記録</label>
      <div class="seen-row"><button class="nbtn wide seen-go" onclick="submitSeen('${a.id}')">ずかんに記録する</button></div>
      <p class="seen-hint">位置はおおまか（約1km）に記録。データはこの端末に保存されます（Stage1a）。</p>
    </div>`;
  document.body.appendChild(m);
}
function closeSeen(){ onboardPendingSeen=false; const m=document.getElementById('seenModal'); if(m)m.remove(); }   // 記録せず閉じたら祝福の印もクリア（submitSeenは事前にローカル退避済み）
function seenPreview(inp){ const f=inp.files&&inp.files[0]; const p=document.getElementById('seenPrev'); if(!f||!p)return;
  downscalePhoto(f,420).then(u=>{ if(u){ p.hidden=false; p.dataset.url=u; const im=p.querySelector('img'); if(im)im.src=u; } }); }
function submitSeen(id){
  const a=ANIMALS.find(x=>x.id===id); if(!a)return;
  const fromOnboard=onboardPendingSeen; onboardPendingSeen=false;   // closeSeen前に退避＝オンボの身近な種タップ由来の記録か
  const noteEl=document.getElementById('seenNote'); const note=(noteEl&&noteEl.value||'').trim();
  const maybe=!!(document.getElementById('seenMaybe')&&document.getElementById('seenMaybe').checked);
  const prev=document.getElementById('seenPrev'); const photo=(prev&&!prev.hidden&&prev.dataset.url)||null;
  const loc=(typeof getLastLoc==='function')?getLastLoc():null;
  const first=!USER.hasSeen(id);
  const rec={ id:a.id, sci:a.nameSci, at:Date.now(),
    lat:loc?Math.round(loc.lat*100)/100:null, lng:loc?Math.round(loc.lng*100)/100:null,
    place:null, note:note||null, photo, confidence: photo?'photo':(maybe?'maybe':'sure') };
  const res=USER.add(rec);
  closeSeen();
  if(!res.ok){ toast('⚠️','端末の保存容量がいっぱいで記録できませんでした。写真を減らすかMyずかんを整理してね', 3200); return; }   // 永続失敗＝巻き戻し済み。偽の成功表示を出さない
  updateSeenBtn(id);
  const gotPhoto=!!rec.photo;   // 容量超過で写真が捨てられた場合は false＝toast/XP と実保存を一致させる
  ANALYTICS.track('sighting'); if(first)ANALYTICS.track('sighting_first'); if(gotPhoto)ANALYTICS.track('sighting_photo');   // 端末内解析：北極星の元イベント
  toast(gotPhoto?'📸':'👀', `${a.nameJa} を${first?'はじめて':''}記録！ +${first?50:5}XP${gotPhoto?' +10📷':''}`, 2600);
  if(first && ['CR','EN','VU','NT'].includes(a.status) && typeof confetti==='function') confetti();   // レアな種＝ちょい演出
  checkQuests();   // この記録で達成したクエストがあればXP/バッジ/演出（記録toastの後に出る）
  if(onboarding && fromOnboard) welcomeCelebrate();   // オンボの身近な種タップ由来の記録だけ祝福（通常のカード/近く記録は不変・誤発火しない）
}
// 📔 Myずかん（自分が見た記録・レベル・連続記録）
function openMyDex(){
  closeMyDex();
  ANALYTICS.track('mydex_opened');
  checkQuests();   // 開いた時点で達成済み（連続記録/期間系など）があれば付与してから描画
  const base=USER.xp(), qx=questXp(), xp=base+qx;   // 総XP＝記録XP＋クエストボーナス
  const lv=Math.floor(Math.sqrt(xp/50))+1, sc=USER.speciesCount(), st=USER.streak();
  const qsorted=[...QUESTS].sort((a,b)=>(QDONE.has(a.id)?1:0)-(QDONE.has(b.id)?1:0));   // 未達成を上に
  const qrows=qsorted.map(q=>{ const e=evalQuest(q), done=QDONE.has(q.id)||e.done, pct=Math.round(100*e.progress/e.need);
    const unit=q.metric==='streak'?'日':'種';
    return `<div class="q-row${done?' done':''}">
      <div class="q-top"><span class="q-ttl">${done?'✅ ':''}${esc(q.title)}</span><span class="q-xp">+${q.rewardXp}XP</span></div>
      <div class="q-desc">${esc(q.desc)}</div>
      <div class="q-bar"><span style="width:${done?100:pct}%"></span></div>
      <div class="q-prog">${e.progress}/${e.need}${unit}${done?' ・ 達成！':''}</div>
    </div>`; }).join('');
  const rows=USER.recent(50).map(s=>{ const a=ANIMALS.find(x=>x.id===s.id);
    const nm=a?a.nameJa:(s.sci||s.id), em=a?a.emoji:'🐾', d=new Date(s.at), ds=(d.getMonth()+1)+'/'+d.getDate();
    const cf=s.confidence==='photo'?'📷':(s.confidence==='maybe'?'❓':'👀');
    return `<button class="myd-row" onclick="closeMyDex();selectAnimal('${s.id}')">
      <span class="myd-th">${s.photo?`<img src="${s.photo}" alt="">`:em}</span>
      <span class="myd-mid"><b>${esc(nm)}</b><span class="myd-sub">${cf} ${ds}${s.note?' · '+esc(s.note):''}</span></span></button>`;
  }).join('')||'<div class="myd-empty">まだ記録がありません。近くの生きものや図鑑カードで「👀見た！」を押してみよう。</div>';
  const m=document.createElement('div'); m.className='modal'; m.id='myDexModal'; m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true');
  m.innerHTML=`<div class="modal-bg" onclick="closeMyDex()"></div>
    <div class="modal-card myd-card">
      <button class="pclose" onclick="closeMyDex()" aria-label="閉じる">✕</button>
      <h2>📔 Myずかん</h2>
      <div class="myd-stats">
        <div class="myd-st"><b>Lv.${lv}</b><span>レベル</span></div>
        <div class="myd-st"><b>${sc}</b><span>見た種</span></div>
        <div class="myd-st"><b>${xp}</b><span>XP</span></div>
        <div class="myd-st"><b>${st}日</b><span>連続記録</span></div>
      </div>
      <h3>🏅 クエスト（${QDONE.size}/${QUESTS.length} 達成）</h3>
      <div class="q-list">${qrows}</div>
      <h3>さいきん見た</h3>
      <div class="myd-list">${rows}</div>
    </div>`;
  document.body.appendChild(m);
}
function closeMyDex(){ const m=document.getElementById('myDexModal'); if(m)m.remove(); }
// ===== クエスト（criteria + 汎用エンジン1本・進捗はsightingsから算出・達成時のみ記録／docs/design/03）=====
const QSEV={LC:1,NT:2,VU:3,EN:4,CR:5,DD:0,NE:0};   // 保全/レア度の段階（危機が高い順）＝RARITYを解禁して使う
function rarityTier(status){ return QSEV[status]||0; }
const QDONE=new Set(JSON.parse(localStorage.getItem('biosphere_quests')||'[]'));   // 達成済みクエストid（XP/バッジは一度きり）
function saveQuests(){ try{ localStorage.setItem('biosphere_quests',JSON.stringify([...QDONE])); }catch(e){} }
function kmBetween(aLat,aLng,bLat,bLng){ const R=6371,t=x=>x*Math.PI/180;
  const dLa=t(bLat-aLat),dLo=t(bLng-aLng),s=Math.sin(dLa/2)**2+Math.cos(t(aLat))*Math.cos(t(bLat))*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(s)); }
// 初期クエスト（手作り＝コンテンツの種。エンジンは汎用なので後はデータ追加で増やせる）。match省略の条件は無視＝全件一致。
const QUESTS=[
  {id:'q_first',      title:'はじめの一歩',   desc:'なんでも1種を「👀見た！」', group:'入門', metric:'species', match:{}, need:1, rewardXp:50},
  {id:'q_bird1',      title:'はじめての鳥',   desc:'鳥を1種 記録しよう', group:'入門', metric:'species', match:{cls:['鳥類']}, need:1, rewardXp:60, badge:'bird1'},
  {id:'q_photo1',     title:'はじめての一枚', desc:'写真つきで1種 記録', group:'入門', metric:'species', match:{photo:true}, need:1, rewardXp:60, badge:'photo1'},
  {id:'q_local5',     title:'ご近所コレクター', desc:'家の近く(約50km)で5種', group:'地元', metric:'species', match:{radiusKm:50}, need:5, rewardXp:150, badge:'local'},
  {id:'q_streak3',    title:'3日つづけて',    desc:'3日つづけて記録する', group:'習慣', metric:'streak', match:{}, need:3, rewardXp:120, badge:'streak3'},
  {id:'q_water3',     title:'水辺のいきもの', desc:'湿地・海の生きものを3種', group:'環境', metric:'species', match:{biome:['湿地','海']}, need:3, rewardXp:120},
  {id:'q_forest4',    title:'森の住人',       desc:'森の哺乳類・鳥を4種', group:'環境', metric:'species', match:{biome:['森林','熱帯雨林'],cls:['哺乳類','鳥類']}, need:4, rewardXp:140},
  {id:'q_sky10',      title:'空の常連',       desc:'鳥を10種 見た！', group:'環境', metric:'species', match:{cls:['鳥類']}, need:10, rewardXp:250, badge:'birder'},
  {id:'q_bugs5',      title:'足もとの虫',     desc:'昆虫を5種', group:'環境', metric:'species', match:{cls:['昆虫']}, need:5, rewardXp:150},
  {id:'q_spring5',    title:'春の使者',       desc:'3〜5月に5種 記録', group:'季節', metric:'species', match:{months:[3,4,5]}, need:5, rewardXp:150},
  {id:'q_summer4',    title:'夏の虫・かえる', desc:'7〜8月に昆虫・両生類を4種', group:'季節', metric:'species', match:{months:[7,8],cls:['昆虫','両生類']}, need:4, rewardXp:140},
  {id:'q_migrate3',   title:'渡り鳥ウォッチ', desc:'渡りをする鳥を3種', group:'季節', metric:'species', match:{cls:['鳥類'],migratory:true}, need:3, rewardXp:160, badge:'migration'},
  {id:'q_threatened', title:'絶滅危惧を知る', desc:'絶滅危惧(VU以上)を1種', group:'保全', metric:'species', match:{rarityMin:3}, need:1, rewardXp:100, badge:'conserv'},
  {id:'q_rare2',      title:'レアハンター',   desc:'超レア(EN以上)を2種', group:'レア', metric:'species', match:{rarityMin:4}, need:2, rewardXp:200, badge:'rare'},
];
function matchSighting(s,m){
  const a=ANIMALS.find(x=>x.id===s.id);
  if(m.cls && (!a||!m.cls.includes(clsOf(a)))) return false;
  if(m.biome && (!a||!m.biome.includes(a.biome))) return false;
  if(m.rarityMin && (!a||rarityTier(a.status)<m.rarityMin)) return false;
  if(m.migratory && (!a||!MIGRATION[a.id])) return false;
  if(m.photo && !(s.photo||s.confidence==='photo')) return false;
  if(m.months && m.months.indexOf(new Date(s.at).getMonth()+1)<0) return false;
  if(m.radiusKm){ const h=(typeof getLastLoc==='function')?getLastLoc():null;
    if(!h||s.lat==null||s.lng==null||kmBetween(h.lat,h.lng,s.lat,s.lng)>m.radiusKm) return false; }
  return true;
}
function evalQuest(q){
  if(q.metric==='streak'){ const p=USER.streak(); return {progress:Math.min(p,q.need),need:q.need,done:p>=q.need}; }
  const seen=new Set(); for(const s of USER.all()){ if(matchSighting(s,q.match)) seen.add(s.id); }   // distinct な種数を数える
  return {progress:Math.min(seen.size,q.need),need:q.need,done:seen.size>=q.need};
}
function questXp(){ return QUESTS.reduce((x,q)=>x+(QDONE.has(q.id)?q.rewardXp:0),0); }   // 達成クエストのボーナスXP合計
// sightings/streak が変わったら呼ぶ＝新たに達成したクエストにXP/バッジ/演出を一度だけ付与
function checkQuests(){
  const newly=[];
  for(const q of QUESTS){ if(QDONE.has(q.id)) continue; if(evalQuest(q).done){ QDONE.add(q.id); if(q.badge) BADGES.add('q_'+q.badge); newly.push(q); } }
  if(newly.length){ saveQuests(); if(typeof saveBadges==='function') saveBadges(); newly.forEach(()=>ANALYTICS.track('quest_done'));
    const xp=newly.reduce((s,q)=>s+q.rewardXp,0);
    const msg=newly.length===1?`クエスト達成！「${newly[0].title}」 +${newly[0].rewardXp}XP`:`クエスト${newly.length}個達成！ +${xp}XP`;
    setTimeout(()=>{ toast('🏅',msg,3400); if(typeof confetti==='function') confetti(); }, 1400);   // 記録toastの後に見せる
  }
  return newly.length;
}
// ===== 軽量アクセス解析（端末内だけ・外部送信なし・プライバシー配慮／docs/design/08 §8.3⑦）=====
// 北極星指標＝「週1回以上"見た！"する人」。バックエンド無しの Stage1a では"この端末"の週次アクティブとファネルをローカル集計＝
// 自分のドッグフーディング（毎日/毎週使うか）を測る。track() は将来 Stage1b で Supabase/解析基盤へPOSTできる seam（今は localStorage のみ）。
// ★保存するのはイベント名・回数・時刻・日付だけ＝個人情報も座標も一切保存しない。
const ANALYTICS = (()=>{
  const LS='biosphere_analytics';
  let d; try{ d=JSON.parse(localStorage.getItem(LS)||'{}'); }catch(e){ d={}; }
  d.ev=d.ev||{};         // イベント名→回数
  d.first=d.first||{};   // イベント名→初回時刻(ms)
  d.last=d.last||{};     // イベント名→最終時刻(ms)
  d.days=Array.isArray(d.days)?d.days:[];   // 開いた日(YYYY-MM-DD)のユニーク集合
  const save=()=>{ try{ localStorage.setItem(LS,JSON.stringify(d)); }catch(e){} };
  const dstr=t=>{ const x=new Date(t); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
  // ISO週キー（"見た！"の週次アクティブ判定用）＝木曜基準の標準アルゴリズム
  const weekKey=t=>{ const x=new Date(t); x.setHours(0,0,0,0); x.setDate(x.getDate()+3-((x.getDay()+6)%7));
    const wk1=new Date(x.getFullYear(),0,4); const wn=1+Math.round(((x-wk1)/86400000-3+((wk1.getDay()+6)%7))/7);
    return x.getFullYear()+'-W'+String(wn).padStart(2,'0'); };
  return {
    track(ev){ if(!ev)return; d.ev[ev]=(d.ev[ev]||0)+1; const now=Date.now(); if(!d.first[ev])d.first[ev]=now; d.last[ev]=now; save(); },
    markDay(){ const t=dstr(Date.now()); if(!d.days.includes(t)){ d.days.push(t); if(d.days.length>400)d.days=d.days.slice(-400); save(); } },
    daysActive(){ return d.days.length; },
    // 北極星：この端末が「今週"見た！"した」か＝週次アクティブ・レコーダー。連続週数・記録のあった週数も返す。
    northStar(){
      const weeks=new Set((USER.all()||[]).map(s=>weekKey(s.at)));
      const now=new Date(), lastWk=new Date(now); lastWk.setDate(lastWk.getDate()-7);
      const activeThisWeek=weeks.has(weekKey(now.getTime()));
      // 連続週：今週(無ければ先週から猶予)を起点に、カレンダー日で7日ずつ遡る（setDateはDST安全＝USER.streakと同じ流儀。ms減算だとDST/深夜起点で週を取りこぼす）
      let cur=activeThisWeek?new Date(now):(weeks.has(weekKey(lastWk.getTime()))?lastWk:null), streak=0;
      while(cur && weeks.has(weekKey(cur.getTime()))){ streak++; cur.setDate(cur.getDate()-7); }
      return { activeThisWeek, weekStreak:streak, weeksWithSighting:weeks.size };
    },
    dump(){ return { ev:d.ev, first:d.first, last:d.last, days:d.days.slice() }; },
  };
})();
// #stats（隠しパネル・自分用ドッグフーディング指標）。外部送信なし＝表示するのはこの端末に貯めた自分のデータだけ。
function openStats(){
  closeStats();
  const ns=ANALYTICS.northStar(), du=ANALYTICS.dump();
  const nSight=(USER.all()||[]).length, nSpec=USER.speciesCount(), lv=USER.level(), days=ANALYTICS.daysActive();
  const order=['visit','welcome_shown','onboard_species_tap','onboard_first_seen','near_opened','world_opened','sighting','sighting_first','sighting_photo','quest_done','mydex_opened'];
  const keys=[...order.filter(k=>k in du.ev), ...Object.keys(du.ev).filter(k=>!order.includes(k)).sort()];
  const evRows=keys.map(k=>`<tr><td>${esc(k)}</td><td>${du.ev[k]}</td><td>${du.first[k]?new Date(du.first[k]).toLocaleDateString('ja-JP'):'—'}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">まだイベントがありません</td></tr>';
  const m=document.createElement('div'); m.className='modal'; m.id='statsModal'; m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true');
  m.innerHTML=`<div class="modal-bg" onclick="closeStats()"></div>
    <div class="modal-card stats-card">
      <button class="pclose" onclick="closeStats()" aria-label="閉じる">✕</button>
      <h2>📊 解析（この端末・自分用）</h2>
      <p class="stats-note">外部送信なし。表示はこの端末に貯めた自分のデータだけ。北極星＝<b>週1回以上"見た！"</b>する習慣がつくか（ドッグフーディング）。</p>
      <div class="stats-hero${ns.activeThisWeek?' on':''}">
        <b>${ns.activeThisWeek?'✅ 今週アクティブ':'— 今週まだ"見た！"なし'}</b>
        <span>北極星：週1回以上"見た！" ・ 連続 ${ns.weekStreak} 週 ・ 記録のあった週 ${ns.weeksWithSighting}</span>
      </div>
      <div class="myd-stats">
        <div class="myd-st"><b>${days}</b><span>開いた日数</span></div>
        <div class="myd-st"><b>${nSight}</b><span>総記録</span></div>
        <div class="myd-st"><b>${nSpec}</b><span>見た種</span></div>
        <div class="myd-st"><b>Lv.${lv}</b><span>レベル</span></div>
      </div>
      <h3>ファネル / イベント</h3>
      <div class="stats-tblwrap"><table class="stats-tbl"><thead><tr><th>イベント</th><th>回数</th><th>初回</th></tr></thead><tbody>${evRows}</tbody></table></div>
    </div>`;
  document.body.appendChild(m);
}
function closeStats(){ const m=document.getElementById('statsModal'); if(m)m.remove(); }
const filterState = {biome:null, q:'', facet:''};   // 環境/検索/分類傾向の絞り込みを一元管理
let gbifYear=null;   // GBIF分布の年代フィルタ（&year=...）。null=全期間。動物を切り替えても保持
const YEAR_STOPS=[
  {label:'全期間',     y:null},
  {label:'〜1990年代', y:'1800,1999'},
  {label:'2000年代',   y:'2000,2009'},
  {label:'2010年代',   y:'2010,2019'},
  {label:'2020年代〜', y:'2020,2035'},
];
// 季節移動（キュレーション）。GBIFタイルは月フィルタ(&month=)を無視するため、主要な回遊・渡り種の
// 「繁殖／産卵域 → 越冬／採餌域」を手動データで表示（代表的な経路の模式。c=[経度,緯度]）。
const MIGRATION={
  monarch:{from:{c:[-90,43],label:'夏 繁殖地（北米）'}, to:{c:[-100.3,19.6],label:'冬 越冬地（メキシコ）'}, note:'世代をまたいで北米とメキシコの森を往復する数千kmの大移動'},
  whale:{from:{c:[-148,57],label:'夏 採餌（アラスカ湾）'}, to:{c:[-156,21],label:'冬 繁殖（ハワイ）'}, note:'極域の豊かな採餌場と熱帯の繁殖場を季節で行き来する'},
  steller:{from:{c:[155,57],label:'夏 繁殖（カムチャツカ）'}, to:{c:[144,44],label:'冬 越冬（北海道）'}, note:'ロシア極東で繁殖し、冬に流氷とともに北海道へ南下する'},
  crane:{from:{c:[124,47],label:'夏 繁殖（アムール）'}, to:{c:[120.5,33.5],label:'冬 越冬（中国東部）'}, note:'大陸の個体群はシベリア・中国東北で繁殖し、東部沿岸で越冬する'},
  albatross:{from:{c:[-37,-54],label:'繁殖（南大西洋の島）'}, to:{c:[40,-46],label:'採餌（南極海を周回）'}, note:'繁殖島を拠点に、偏西風に乗って南極海を何千kmも周回採餌する'},
  greenturtle:{from:{c:[144,-11.6],label:'産卵（営巣浜）'}, to:{c:[152,-22],label:'採餌（藻場）'}, note:'遠く離れた採餌の藻場と生まれた営巣浜の間を長距離回遊する'},
  loggerhead:{from:{c:[140,34],label:'産卵（日本）'}, to:{c:[-115,27],label:'成育（東太平洋）'}, note:'太平洋を横断して成育域と産卵地を往復する世界規模の回遊'},
};
// アトラス表示（🏔️）時に重ねる「自然の地理」ラベル。観光名所でなく、分布の意味が分かる自然地形を控えめに。
const NATURAL_PLACES=[
  ['🏜 サハラ砂漠',13,23],['🏜 ゴビ砂漠',103,42],['🏜 アタカマ砂漠',-69,-24],['🏜 カラハリ砂漠',22,-23],['🏜 アラビア砂漠',47,23],
  ['🌳 アマゾン熱帯雨林',-63,-4],['🌳 コンゴ盆地',22,-1],['🌳 ボルネオの森',114,1],
  ['⛰ ヒマラヤ山脈',83,29],['⛰ アンデス山脈',-70,-18],['⛰ ロッキー山脈',-110,44],['⛰ アルプス',10,46],['⛰ 大地溝帯',36,0],
  ['🦓 セレンゲティ',34,-2],['🌾 グレートプレーンズ',-100,41],['🌾 パンパ',-63,-36],['🌾 ユーラシア・ステップ',70,48],
  ['🐠 グレートバリアリーフ',147,-18],['🐢 ガラパゴス諸島',-90,0],['🦎 マダガスカル',47,-19],
  ['❄ グリーンランド',-42,72],['❄ シベリア',100,63],['🌊 バイカル湖',108,53],['🌊 アマゾン川',-58,-2],
];
// おもな脅威：主要種は固有データ、他はbiome/分類/保全状況から導出。絶滅危惧種カードに表示し保全への導線にする。
const THREAT_OVR={
  tiger:['密猟（毛皮・骨）','生息地の分断','獲物の減少'], leopard:['密猟','人との軋轢','生息地の減少'],
  snowleopard:['密猟','家畜との軋轢','気候変動'], jaguar:['森林伐採','人との軋轢','毛皮の違法取引'],
  elephant:['象牙の密猟','人との軋轢','生息地の縮小'], asianelephant:['生息地の分断','人との軋轢','密猟'],
  rhino:['角を狙った密猟','生息地の減少'], whiterhino:['角を狙った密猟','生息地の減少'],
  gorilla:['密猟（ブッシュミート）','森林伐採','感染症'], orangutan:['アブラヤシ農園化','森林火災','密猟'],
  chimp:['森林伐採','ブッシュミート','感染症'], panda:['竹林の分断','生息地の縮小'],
  polarbear:['海氷の減少（気候変動）','汚染'], axolotl:['水質汚染','外来魚','都市化'],
  orca:['汚染（PCB蓄積）','餌の減少','騒音'], bluewhale:['船舶との衝突','漁具への絡まり','騒音'],
  gharial:['河川開発・砂利採取','漁網の混獲'], komodo:['生息地の縮小','獲物の減少','気候変動'],
  // --- 絶滅危惧（CR/EN/VU）の固有脅威を拡充 ---
  lion:['生息地の縮小','獲物の減少','家畜被害への報復'], cheetah:['生息地の分断','獲物の減少','幼獣の違法取引'],
  koala:['森林伐採・都市化','山火事','病気（クラミジア）'], giraffe:['生息地の減少・分断','密猟（肉・皮）','土地利用の拡大'],
  hippo:['水場・生息地の減少','牙や肉目的の密猟','人との軋轢'], redpanda:['森林の伐採・分断','密猟（毛皮・ペット）','放牧による劣化'],
  anteater:['生息地の破壊','交通事故（ロードキル）','火災'], condor:['鉛中毒（狩猟弾）','毒餌・迫害','生息地の減少'],
  otter:['油流出','漁具への混獲','過去の毛皮乱獲の影響'], crane:['湿地の減少・開発','農薬・人間活動','送電線への衝突'],
  shoebill:['湿地の破壊・転換','卵やヒナの捕獲・取引','人による撹乱'], galapagostortoise:['外来種（ネズミ・ヤギ等）','過去の乱獲の影響','生息地の競合'],
  greenturtle:['漁具による混獲','産卵地の開発','卵・肉の採取'], whaleshark:['漁業による捕獲・混獲','船舶との衝突','ヒレ・肉の取引'],
  greatwhite:['漁具による混獲','ヒレ・歯・顎の取引','保護管理の不足'], albatross:['延縄漁による混獲','海洋プラスチックの誤飲','営巣地の外来種'],
  humboldtpenguin:['漁業との競合・混獲','エルニーニョによる餌減少','営巣地（グアノ）の採取'], tasmaniandevil:['伝染性がん（DFTD）','交通事故（ロードキル）','生息地の減少'],
  kiwi:['外来捕食者（オコジョ・イヌ等）','生息地の減少','交通事故'], walrus:['海氷の減少（気候変動）','人間活動による撹乱','狩猟'],
  okapi:['森林伐採','密猟','地域紛争による混乱'], loggerhead:['漁具による混獲','産卵地の開発','卵の採取・海洋汚染'],
  slothbear:['生息地の喪失・分断','人との軋轢','体の一部の密猟取引'], lemur:['森林伐採・焼畑','狩猟（食用）','ペット取引'],
  dugong:['漁網への混獲','海草藻場の減少','沿岸開発・船舶事故'], spermwhale:['漁具への絡まり','船舶との衝突','海洋汚染・騒音'],
  arabianoryx:['違法な捕獲','生息地の劣化','干ばつ'], przewalski:['生息地と水場の喪失','家畜との競合・交雑','遺伝的多様性の低さ'],
  kingcobra:['森林伐採による生息地減少','皮・薬用の捕獲','人による殺害'], marineiguana:['外来捕食者（ネコ・ネズミ）','油流出','エルニーニョによる餌減少'],
  giantsalamander:['河川改修・ダム','水質汚染','外来種との交雑'], mantaray:['鰓耙（ギルレーカー）目的の漁','漁具への混獲','生息地の撹乱'],
  seahorse:['漢方・観賞用の乱獲','漁具への混獲','藻場（生息地）の破壊'], steller:['河畔林の開発','鉛中毒（狩猟弾）','漁業や開発の影響'],
  baobab:['若木の更新不良','気候変動・乾燥化','農地への転換'], sequoia:['山火事の激甚化','気候変動・乾燥','分布域の限定'],
  rafflesia:['熱帯林の破壊','宿主植物（つる）の減少','採取・観光圧'], bullshark:['漁業による捕獲・混獲','ヒレ目的の漁','沿岸環境の悪化'],
  oceansunfish:['漁具への混獲','海洋プラスチックの誤飲','船舶との衝突'], leatherbackseaturtle:['漁具による混獲','卵の採取','産卵地開発・海洋プラスチック'],
  shortfinmako:['漁業による乱獲・混獲','ヒレ・肉の取引','管理の不足'], hawksbillseaturtle:['べっ甲目的の乱獲','漁具による混獲','産卵地・サンゴ礁の劣化'],
  europeanrabbit:['ウイルス病（粘液腫・RHD）','生息地の減少','狩猟・捕食'], oliveridleyturtle:['漁具による混獲','卵の採取','産卵地の開発'],
  spottedeagleray:['漁業による混獲','標的漁','沿岸環境の悪化'], scallopedhammerhead:['フカヒレ目的の漁','漁具への混獲','幼魚育成域の劣化'],
  queenalexandrasbirdwing:['熱帯林のアブラヤシ農園化','分布の極端な限定','違法な採集'], giantoceanicmantaray:['鰓耙目的の漁','漁具への混獲','繁殖力の低さ'],
  sandtigershark:['漁業による乱獲・混獲','繁殖力の低さ','生息地の撹乱'], reindeer:['気候変動による環境変化','開発による生息地分断','過剰な狩猟'],
  aldabragianttortoise:['分布が1か所に集中','気候変動・海面上昇','外来種'], snowyowl:['気候変動による繁殖環境の変化','餌（レミング）の変動','人工物との衝突'],
  greycrownedcrane:['湿地の喪失・劣化','違法な捕獲・取引','農薬・送電線'], proboscismonkey:['沿岸林のアブラヤシ・養殖転換','森林の分断','狩猟'],
  // --- 追加種（絶滅危惧）---
  mandrillzz:['ブッシュミート猟','森林伐採','生息地の分断'],
  ayeaye:['森林伐採','迷信による殺害','生息地の分断'],
  manateefl:['船舶との衝突','漁網への絡まり','生息地（暖水域）の喪失'],
  quokka:['外来捕食者（キツネ・ネコ）','生息地の喪失','山火事'],
  pygmyhippo:['森林伐採','密猟','内戦・人間活動'],
  pangolinz:['違法取引（鱗・肉）のための密猟','森林伐採','生息地の減少'],
  fossazz:['森林伐採','人との軋轢','獲物の減少'],
  coelacanth:['混獲','生息地の撹乱','繁殖力の低さ'],
  secretarybird:['草原の農地化・劣化','送電線・道路','獲物の減少'],
  harpyeagle:['森林伐採','営巣木の喪失','迫害（射殺）'],
  atlanticpuffin:['餌（小魚）の減少','海洋汚染','営巣地の外来種'],
  kakapo:['外来捕食者（ネコ・イタチ等）','繁殖力の低さ','感染症'],
  goliathfrog:['食用の捕獲','生息地（急流林）の破壊','ペット取引'],
  coconutcrab:['乱獲（食用）','島嶼の開発','成長が遅く繁殖力が低い'], mexicanredknee:['ペット取引のための乱獲','生息地の破壊'],
  horseshoecrab:['干潟の埋め立て','採血・漁業利用','混獲'], giantclam:['食用・貝殻目的の乱獲','サンゴ礁の劣化','密漁'],
};
function threatsOf(a){
  if(THREAT_OVR[a.id]) return THREAT_OVR[a.id];
  const t=[], b=a.biome, cls=classOf(a);
  if(b==='熱帯雨林'||b==='森林') t.push('森林伐採による生息地の破壊');
  else if(b==='海') t.push('混獲・乱獲');
  else if(b==='極地') t.push('気候変動による海氷の減少');
  else if(b==='サバンナ'||b==='草原') t.push('生息地の農地化');
  else if(b==='湿地') t.push('湿地の埋め立て・開発');
  else t.push('開発による生息地の改変');
  if(['サイ科','ゾウ科'].includes(a.taxon)) t.push('密猟');
  else if(['ネコ科','イヌ科','クマ科'].includes(a.taxon)) t.push('人との軋轢');
  else if(cls==='両生類') t.push('ツボカビ症・水質汚染');
  else if(b==='海') t.push('海洋汚染');
  t.push('気候変動');
  return [...new Set(t)].slice(0,3);
}
function conservLinks(a){
  return [
    {l:'IUCNで状況を見る', u:iucnURL(a)},
    {l:'保全活動・団体を調べる', u:'https://www.google.com/search?q='+encodeURIComponent(a.nameJa+' '+a.nameSci+' 保全 conservation')},
  ];
}
// └───────────────────────────────────────── /data.js ─────────────────────────────────────────┘

// ┌───────────────────────────────────────── map.js ─────────────────────────────────────────┐
const map = window.map = new maplibregl.Map({
  container:'map',
  style:{version:8,
    // フォント/アイコン（glyphs/sprite）は OFM 初回ロード時に setGlyphs/setSprite で注入＝
    // 地球儀既定では一切読まない（OFMフリー）。MapLibre 5 は両APIを備える。
    sources:{carto:{type:'raster',
      tiles:['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png','https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png','https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png','https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      tileSize:256, attribution:'© OpenStreetMap © CARTO'}},
    layers:[{id:'bg',type:'background',paint:{'background-color':'#070b11'}},
      {id:'carto',type:'raster',source:'carto',paint:{'raster-opacity':.9,'raster-saturation':-.1,'raster-contrast':.05}}]},
  center:[18,16], zoom:1.45, minZoom:.7, maxZoom:16, attributionControl:false, dragRotate:true, pitchWithRotate:false
});
map.addControl(new maplibregl.AttributionControl({compact:true, customAttribution:'観測点: GBIF.org'}), 'bottom-right');
map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'bottom-right');

map.on('load', async ()=>{
  try{ map.setProjection({type:'globe'}); }catch(e){}
  try{ map.setSky({'sky-color':'#0a1320','horizon-color':'#16324a','fog-color':'#070b11','sky-horizon-blend':.6,'horizon-fog-blend':.5,'fog-ground-blend':.7,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.85,4,.4,7,0]}); }catch(e){}
  try{
    // 国境データはローカル同梱（外部jsdelivr依存を排除・同一オリジン配信）。拡張子は .json＝GitHub Pagesがgzipする（.geojsonはMIME未登録で無圧縮になる）。
    // 元 Natural Earth ne_110m を「アプリが実際に読む8プロパティ」だけに削減（生819KB→274KB・gzip約101KB・ジオメトリ無改変・等価性検証済み）。
    const res=await fetch('data/ne_110m_admin_0_countries.json');
    if(!res.ok) throw new Error('countries '+res.status);
    countryGeo=await res.json();
  }catch(e){ bootFail('国境データを読み込めませんでした。'); return; }
  const p0=countryGeo.features[0].properties;
  CODE_PROP=['ADM0_A3','ISO_A3_EH','ISO_A3','iso_a3','adm0_a3'].find(k=>k in p0)||'ADM0_A3';
  // A3→A2（GBIF実データの国別クエリに使用）
  countryGeo.features.forEach(f=>{const p=f.properties;const a3=p[CODE_PROP];const a2=p.ISO_A2||p.ISO_A2_EH;if(a3&&a2&&a2!=='-99')A3toA2[a3]=a2;});

  map.addSource('countries',{type:'geojson',data:countryGeo});
  map.addLayer({id:'c-fill',type:'fill',source:'countries',paint:{'fill-color':'rgba(0,0,0,0)','fill-opacity':.72}});
  map.addLayer({id:'c-glow',type:'line',source:'countries',layout:{'line-join':'round'},paint:{'line-color':'#34d8c6','line-width':7,'line-blur':6,'line-opacity':0}});
  map.addLayer({id:'c-active',type:'line',source:'countries',paint:{'line-color':'#34d8c6','line-width':1.4,'line-opacity':0}});
  map.addLayer({id:'c-hover',type:'line',source:'countries',paint:{'line-color':'#ffffff','line-width':1.1,'line-opacity':.55},filter:['==',['get',CODE_PROP],'__none__']});

  // アトラス用：事前レンダリング済みの地形relief（Esri・CORS可）。国境/分布の下に重ね、🏔️でトグル
  try{
    map.addSource('relief',{type:'raster',tiles:['https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:13,attribution:'地形: Esri'});
    map.addLayer({id:'relief',type:'raster',source:'relief',layout:{visibility:'none'},paint:{'raster-opacity':.22,'raster-saturation':-.4,'raster-brightness-max':.62,'raster-contrast':.12,'raster-fade-duration':300}},'c-fill');
  }catch(e){}

  // 「本物の地図」基図は OpenFreeMap（ベクター：街路/鉄道/地名/地形）に統一。🏷️ボタン＝手動トグル、
  // 近く(ローカル)モードでは自動ON（loadOFM/setLocalBasemap）。setStyle不使用＝既存層を全維持。

  mapReady=true; bindMap();
  if(atlasOn) setAtlas(true);
  $('#boot').classList.add('gone');   // 地図シェルを先に表示（種データは待たない＝初回ロード短縮）
  if(LOW_MOTION) spinning=false;   // 低モーション/通信節約時は自動回転しない
  spinLoop();
  // ★起動ビューは地図準備でき次第すぐ実行（種データ1.9MBの到着を待たない＝近所の地図と生き物が速く出る）。
  //   近所/地点リンクは ANIMALS 不要で即開始。種ディープリンク(#id)だけ bootInitialView 内で __speciesReady を待つ。
  bootInitialView();
  __speciesReady.then(updateDex);   // 種データ到着で図鑑コンプ率（n/総数）を反映
});
// GBIFタイルの読み込み完了/失敗を検知してスピナーを止める（失敗しても図鑑カードは常に表示される）
map.on('error',(e)=>{ if(e && e.sourceId==='gbif') gbifLoading(false); });
map.on('sourcedata',(e)=>{ if(e.sourceId==='gbif' && map.getSource('gbif') && map.isSourceLoaded('gbif')) gbifLoading(false); });

/* ---------- OpenFreeMap ベクター基図（街路/鉄道/地名/地形）----------
   setStyle総入替は禁止（gbif/relief/near-me/countries 等のカスタム層が消える）。
   実行中スタイルへ OFM の source/layer を「既存カスタム層の下」に注入し、暗いcarto基図と
   visibility で切替える。近く(ローカル)モードで自動ON＝本物の地図を主役の生き物の下に敷く。 */
const OFM_STYLE='https://tiles.openfreemap.org/styles/liberty';
let ofmLoaded=false, ofmLoading=null, ofmLayerIds=[], localMapOn=false;
let localMapAutoOn=false;   // 近くモードが自動ONした基図か（手動🏷️ONはfalse）。離脱時の自動OFFを「自動分だけ」に限定する。
function loadOFM(){
  if(ofmLoaded) return Promise.resolve(true);
  if(ofmLoading) return ofmLoading;
  ofmLoading = fetch(OFM_STYLE).then(r=>{ if(!r.ok) throw new Error('OFM '+r.status); return r.json(); }).then(st=>{
    try{ if(map.setGlyphs && st.glyphs) map.setGlyphs(st.glyphs); }catch(e){}   // 配信側ハッシュ変更にも追従（任意）
    try{ if(map.setSprite && st.sprite) map.setSprite(st.sprite); }catch(e){}
    // ne2_shaded（地形ラスタ）は重い（巨大PNG）＆🏔️relief と重複するので読み込まない＝軽量化。
    for(const [id,src] of Object.entries(st.sources||{})){ if(id==='ne2_shaded') continue; if(!map.getSource(id)){ try{ map.addSource(id,src); }catch(e){} } }
    const anchor=['relief','c-fill','c-glow','c-active'].find(id=>map.getLayer(id));   // 既存カスタム層の直下へ
    for(const layer of (st.layers||[])){
      if(map.getLayer(layer.id) || layer.source==='ne2_shaded') continue;
      const L=Object.assign({},layer);
      // 追加時点で目的の可視状態に固定（ロード完了が遅れて localMapOn=false の時に一瞬可視になるちらつき/競合を排除）
      L.layout=Object.assign({}, L.layout, {visibility: localMapOn?'visible':'none'});
      // 日本語ラベル優先（name:ja→現地→latin）。道路番号(ref)系はそのまま。
      if(L.type==='symbol' && L.layout['text-field'] && JSON.stringify(L.layout['text-field']).includes('name:latin')){
        L.layout=Object.assign({},L.layout,{'text-field':['coalesce',['get','name:ja'],['get','name:nonlatin'],['get','name:latin'],['get','name']]});
      }
      try{ map.addLayer(L,anchor); ofmLayerIds.push(L.id); }catch(e){}
    }
    ofmLoaded=true; return true;
  }).catch(e=>{ ofmLoading=null; console.warn('OFM load failed',e&&e.message); return false; });
  return ofmLoading;
}
// OFMレイヤーと暗いcarto基図の表示を localMapOn に合わせて切替（OFM未ロード/失敗時は carto のまま＝安全）。
function applyLocalBasemap(){
  if(ofmLoaded){ const v=localMapOn?'visible':'none';
    ofmLayerIds.forEach(id=>{ if(map.getLayer(id)) try{ map.setLayoutProperty(id,'visibility',v); }catch(e){} }); }
  if(map.getLayer('carto')) map.setLayoutProperty('carto','visibility',(localMapOn&&ofmLoaded)?'none':'visible');
  const b=$('#labelBtn'); if(b) b.setAttribute('aria-pressed',String(localMapOn));
}
function setLocalBasemap(on){
  localMapOn=!!on;
  if(!mapReady){ const b=$('#labelBtn'); if(b)b.setAttribute('aria-pressed',String(localMapOn)); return; }
  if(localMapOn) loadOFM().then(applyLocalBasemap);   // 初回ON時のみ遅延ロード（地球儀既定では一切読まない）
  else applyLocalBasemap();
}

/* ---------- 描画 ---------- */
function setFill(expr){ if(mapReady) map.setPaintProperty('c-fill','fill-color',expr); }
function clearActive(){
  if(!mapReady)return;
  map.setPaintProperty('c-active','line-opacity',0); map.setPaintProperty('c-glow','line-opacity',0);
  map.setFilter('c-active',['==',['get',CODE_PROP],'__none__']); map.setFilter('c-glow',['==',['get',CODE_PROP],'__none__']);
}
function setActive(codes,color){
  if(!mapReady)return;
  const f=['in',['get',CODE_PROP],['literal',codes]];
  map.setFilter('c-active',f); map.setFilter('c-glow',f);
  map.setPaintProperty('c-active','line-color',color); map.setPaintProperty('c-glow','line-color',color);
  map.setPaintProperty('c-active','line-opacity',.95); map.setPaintProperty('c-glow','line-opacity',.55);
}
function gbifLoading(on){ const b=$('#gbifBtn'); if(b) b.classList.toggle('loading',!!on); }   // 🛰️ボタンにスピナー
function removeGbif(){ if(!mapReady)return;
  if(map.getLayer('gbif'))map.removeLayer('gbif'); if(map.getLayer('gbif-glow'))map.removeLayer('gbif-glow');
  if(map.getLayer('gbif3d'))map.removeLayer('gbif3d'); if(map.getSource('gbif3d'))map.removeSource('gbif3d');
  if(map.getSource('gbif'))map.removeSource('gbif'); gbifLoading(false); }
function addGbif(key, wide){
  if(!mapReady)return; removeGbif(); gbifLoading(true);
  if(dist3D){ addGbif3D(key, wide); return; }                        // 3D（立体）モードのときは押し出しレイヤーへ
  map.addSource('gbif',{type:'raster',tiles:[gbifTileURL(key, gbifYear, wide)],tileSize:512,attribution:'観測点: GBIF.org'});
  // 下層：にじみグロー（線形リサンプルでぼかし、密度の高い所がぼうっと発光＝立体感。低密度も視認しやすく）
  map.addLayer({id:'gbif-glow',type:'raster',source:'gbif',paint:{'raster-opacity':.5,'raster-resampling':'linear','raster-saturation':.25,'raster-fade-duration':260}},'c-glow');
  // 上層：くっきりヘックス＋彩度/コントラストを上げ「色の濃さ」を強調
  map.addLayer({id:'gbif',type:'raster',source:'gbif',paint:{'raster-opacity':.98,'raster-resampling':'nearest','raster-saturation':.35,'raster-contrast':.18}},'c-glow');
}
// 3D（立体）分布：GBIFのMVTヘックス（プロパティ total=観測数）を fill-extrusion で高さ表現。試験的トグル。
function gbif3dURL(key, wide){
  return 'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}.mvt?srs=EPSG:3857&taxonKey='+key
       +'&bin=hex&hexPerTile=45'+gbifBasisQ(wide)+(gbifYear?('&year='+gbifYear):'');
}
function addGbif3D(key, wide){
  map.addSource('gbif3d',{type:'vector',tiles:[gbif3dURL(key, wide)],minzoom:0,maxzoom:14,attribution:'観測点: GBIF.org'});
  map.addLayer({id:'gbif3d',type:'fill-extrusion',source:'gbif3d','source-layer':'occurrence',paint:{
    'fill-extrusion-color':['interpolate',['linear'],['get','total'],1,'#1fb6a6',8,'#7CFC55',40,'#ffd54a',180,'#ff8c1a',900,'#ff3322'],
    'fill-extrusion-height':['interpolate',['linear'],['get','total'],1,30000,40,180000,400,500000,4000,1400000],
    'fill-extrusion-opacity':.82,'fill-extrusion-base':0,'fill-extrusion-vertical-gradient':true
  }},'c-glow');
  map.once('idle',()=>gbifLoading(false));
}
// 時系列スライダー（GBIF &year=）。動物選択中＆GBIF ON のときだけ表示
function showYearbar(on){
  const yb=$('#yearbar'); if(!yb)return;
  stopYearPlay();
  if(!YEARBAR_ON) on=false;   // シンプル化②：年代スライダーは常に隠す（コード残置・復活はYEARBAR_ON=true）
  if(on){ let i=YEAR_STOPS.findIndex(s=>s.y===gbifYear); if(i<0)i=0;
    $('#yearSlider').value=i; $('#yearLabel').textContent=YEAR_STOPS[i].label; yb.removeAttribute('hidden'); updateYearCount(); }
  else yb.setAttribute('hidden','');
}
let yearTileTimer=null;
function applyYear(idx){
  const st=YEAR_STOPS[idx]||YEAR_STOPS[0]; gbifYear=st.y; $('#yearLabel').textContent=st.label;
  if(currentAnimal && gbifOn && currentAnimal.gbif){
    setMode(animalModeText(currentAnimal));                        // ラベル/モードは即時更新（操作感）
    updateYearCount();                                             // 「この年代の記録数」を更新＝昔はたくさんいた/少ない を体感化
    clearTimeout(yearTileTimer);                                   // タイル再取得はデバウンス（ドラッグ中の連続リクエストを抑制）
    yearTileTimer=setTimeout(()=>{ if(currentAnimal&&gbifOn&&currentAnimal.gbif) addGbif(currentAnimal.gbif, isWideBasis(currentAnimal)); },180);
  }
}
// 年代別の観測数（GBIF件数）。年代を変えると数が変わり「昔はたくさんいた/まだ記録が少ない」が感覚的に伝わる。確定時に取得・キャッシュ。
const yearCountCache={};
let yearCountTimer=null, yearCountMax={};
function updateYearCount(){
  const el=$('#yearCount'); if(!el) return;
  if(!currentAnimal||!gbifOn||!currentAnimal.gbif){ el.textContent=''; return; }
  const taxon=currentAnimal.gbif, yr=gbifYear, key=taxon+'@'+(yr||'all');
  if(key in yearCountCache){ paintYearCount(el,taxon,yearCountCache[key]); return; }
  el.textContent='…'; el.classList.remove('lo');
  clearTimeout(yearCountTimer);
  yearCountTimer=setTimeout(async()=>{
    try{
      const q='https://api.gbif.org/v1/occurrence/search?taxonKey='+taxon+'&hasCoordinate=true&limit=0'+(yr?('&year='+yr):'');
      const r=await fetch(q); const d=await r.json(); const n=d.count||0;
      yearCountCache[key]=n;
      if(!yr) yearCountMax[taxon]=n;                               // 全期間＝最大の目安
      if(currentAnimal&&currentAnimal.gbif===taxon&&gbifYear===yr) paintYearCount(el,taxon,n);
    }catch(e){ el.textContent=''; }
  },360);
}
function paintYearCount(el,taxon,n){
  el.innerHTML='📊 '+fmtN(n)+'件';
  const mx=yearCountMax[taxon];                                    // 全期間比で「少ない年代」を橙で示す
  el.classList.toggle('lo', !!(gbifYear && mx && n>0 && n < mx*0.25));
}
// 年代「再生」：全期間→各年代へ時間をたどり、記録の濃淡が動いて見える（移動・増減の体感）
let yearPlayTimer=null, yearPlaying=false;
function stopYearPlay(){ yearPlaying=false; clearTimeout(yearPlayTimer); const b=$('#yearPlay'); if(b){b.classList.remove('playing');b.textContent='▶';b.title='年代を再生（時間をたどる）';} }
function startYearPlay(){
  if(!currentAnimal||!gbifOn||!currentAnimal.gbif) return;
  yearPlaying=true; const b=$('#yearPlay'); if(b){b.classList.add('playing');b.textContent='⏸';b.title='停止';}
  let i=0;
  const step=()=>{
    if(!yearPlaying) return;
    $('#yearSlider').value=i; applyYear(i);
    i++;
    if(i>=YEAR_STOPS.length){ yearPlayTimer=setTimeout(stopYearPlay,1800); return; }
    yearPlayTimer=setTimeout(step,1900);
  };
  step();
}
function animalModeText(a){
  const yl=(gbifOn&&gbifYear)?('・'+((YEAR_STOPS.find(s=>s.y===gbifYear)||{}).label||'')):'';
  return `${a.emoji} ${a.nameJa} の分布（${a.range.length}地域）${gbifOn?' ・GBIF実データ':''}${yl}`;
}

function drawOverview(){
  currentMode={type:'overview'}; currentAnimal=null; removeGbif(); removeMigration(); showYearbar(false);
  const count={}; ANIMALS.forEach(a=>a.range.forEach(c=>count[c]=(count[c]||0)+1));
  const max=Math.max(1,...Object.values(count)); const pairs=[];
  Object.entries(count).forEach(([c,n])=>pairs.push(c,heatColor(n/max)));
  // pairs が空（種データ未到着）なら 'match' はペア無しで無効式になるため透明塗りにフォールバック
  setFill(pairs.length ? ['match',['get',CODE_PROP],...pairs,'rgba(0,0,0,0)'] : 'rgba(0,0,0,0)'); clearActive();
  setMode('世界ぜんたいの分布ヒートマップ');
  if(typeof renderLegend==='function') renderLegend('overview');   // 概観＝国塗りは「種の多さ」→凡例もそれに合わせる
  spawnWorldCreatures();   // ③ 世界ビューにランダム浮遊アイコン（毎回ちがう顔ぶれ・タップで種カード）
}
function heatColor(t){
  const stops=[[0,[26,74,60]],[.5,[33,170,140]],[1,[242,193,78]]];
  for(let i=0;i<stops.length-1;i++){const [t0,c0]=stops[i],[t1,c1]=stops[i+1];
    if(t<=t1){const k=(t-t0)/(t1-t0||1);
      return `rgba(${Math.round(c0[0]+(c1[0]-c0[0])*k)},${Math.round(c0[1]+(c1[1]-c0[1])*k)},${Math.round(c0[2]+(c1[2]-c0[2])*k)},.82)`;}}
  return 'rgba(242,193,78,.85)';
}
function paintAnimal(a){
  const col=RARITY[a.status].color;
  const fillA = gbifOn ? .16 : .7;   // GBIF表示時は国塗りを控えめにして実データ(詳細メッシュ)を主役に
  setFill(['case',['in',['get',CODE_PROP],['literal',a.range]],hexA(col,fillA),'rgba(0,0,0,0)']);
  setActive(a.range,col);
  if(gbifOn && a.gbif) addGbif(a.gbif, isWideBasis(a)); else removeGbif();
  showMigration(a);
  if(typeof renderLegend==='function') renderLegend('status');
}
// メッシュのトグル文言。魚は標本・調査記録も含むので「実観測」とは呼べない（正直さ＝敵対レビュー確定）。陸生は人の目撃のみ＝実観測。
function distName(a){ return isWideBasis(a)?'実際の記録（GBIF）':'実観測（GBIF）'; }
function distBtnLabel(a, on){ const w=isWideBasis(a);
  return on ? (w?'🛰️ 記録メッシュを消す':'🛰️ 実観測メッシュを消す')
            : ('🛰️ '+distName(a)+'を表示'); }
// gbifOn を切り替える2経路（カード内 #cardDistBtn ／ ツールバー #gbifBtn）のラベル・状態を常に一致させる＝どちらから操作しても誤誘導しない（敵対レビュー確定・双方向同期）。
function syncDistBtns(){
  const gb=$('#gbifBtn'); if(gb) gb.setAttribute('aria-pressed',String(gbifOn));
  const cb=$('#cardDistBtn'); if(cb){ cb.classList.toggle('on',gbifOn); cb.innerHTML=distBtnLabel(currentAnimal,gbifOn); }
}
// 動物カード内の「🛰️ 実観測（GBIF）」トグル＝押した場所で戻せる（docs/design/11・C）。グローバル gbifOn と moregroupの🛰️に同期。
function toggleAnimalDist(btn){
  if(!currentAnimal) return;
  gbifOn=!gbifOn;
  paintAnimal(currentAnimal);
  setMode(animalModeText(currentAnimal));
  showYearbar(gbifOn && currentMode.type==='animal');
  syncDistBtns();
}
/* ---------- 季節移動の経路（キュレーション） ---------- */
let migMarkers=[];
function removeMigration(){ migMarkers.forEach(m=>m.remove()); migMarkers=[];
  if(mapReady){ if(map.getLayer('mig-line'))map.removeLayer('mig-line'); if(map.getLayer('mig-glow'))map.removeLayer('mig-glow'); if(map.getSource('mig'))map.removeSource('mig'); } }
function migArc(a,b,bend){ const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2], dx=b[0]-a[0], dy=b[1]-a[1];
  const ctrl=[mid[0]-dy*bend, mid[1]+dx*bend], pts=[];
  for(let t=0;t<=1.0001;t+=0.025){ const u=1-t; pts.push([u*u*a[0]+2*u*t*ctrl[0]+t*t*b[0], u*u*a[1]+2*u*t*ctrl[1]+t*t*b[1]]); }
  return pts; }
function migMarker(c,html,cls){ const el=document.createElement('div'); el.className='migm '+(cls||''); el.innerHTML=html;
  migMarkers.push(new maplibregl.Marker({element:el}).setLngLat(c).addTo(map)); }
function showMigration(a){
  removeMigration(); const mg=a&&MIGRATION[a.id]; if(!mg||!mapReady) return;
  const pts=migArc(mg.from.c,mg.to.c,0.18);
  map.addSource('mig',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:pts}}});
  map.addLayer({id:'mig-glow',type:'line',source:'mig',layout:{'line-cap':'round'},paint:{'line-color':'#1fd0ff','line-width':7,'line-blur':6,'line-opacity':.42}},'c-glow');
  map.addLayer({id:'mig-line',type:'line',source:'mig',layout:{'line-cap':'round'},paint:{'line-color':'#bff6ff','line-width':2.4,'line-dasharray':[2,1.7],'line-opacity':.96}},'c-glow');
  migMarker(mg.from.c, `<span class="dot from"></span><span class="lab">${mg.from.label}</span>`, 'from');
  migMarker(mg.to.c,   `<span class="lab">${mg.to.label}</span><span class="dot to"></span>`, 'to');
  const i=Math.floor(pts.length*0.55), m=pts[i], n=pts[Math.min(i+2,pts.length-1)];
  const ang=Math.atan2(n[0]-m[0], n[1]-m[1])*180/Math.PI;   // 北基準・時計回り。東向き'➤'は -90 補正
  migMarker(m, `<span class="arr" style="transform:rotate(${ang-90}deg)">➤</span>`, 'arrow');
}
function paintBiome(b){
  removeGbif(); removeMigration();
  const set=new Set(); ANIMALS.filter(a=>a.biome===b).forEach(a=>a.range.forEach(c=>set.add(c)));
  const codes=[...set]; const col=BIOMES[b]?BIOMES[b].g[0]:'#34d8c6';
  setFill(['case',['in',['get',CODE_PROP],['literal',codes]],hexA(col,.6),'rgba(0,0,0,0)']); setActive(codes,col);
  if(typeof renderLegend==='function') renderLegend('status');
}
function paintCountry(code){
  removeGbif(); removeMigration();
  setFill(['case',['==',['get',CODE_PROP],code],'rgba(52,216,198,.45)','rgba(0,0,0,0)']); setActive([code],'#34d8c6');
  if(typeof renderLegend==='function') renderLegend('status');
}
function flyTo(c,z){ stopSpin(); map.flyTo({center:c,zoom:z,speed:.85,curve:1.5,essential:true}); pulseArrival(); }
// 到着の一瞬、国アウトライン(c-glow)を一度だけ脈打たせる＝「そこへ降り立った」旅の手応え（有限・setStyle/rAF不使用）。
function pulseArrival(){
  if(!mapReady||LOW_MOTION||!map.getLayer('c-glow')) return;
  const mode=currentMode;
  map.once('moveend',()=>{
    if(currentMode!==mode||!map.getLayer('c-glow')) return;   // 到着前に別モードへ移ったら無効化
    try{
      map.setPaintProperty('c-glow','line-opacity',.95); map.setPaintProperty('c-glow','line-width',13);
      setTimeout(()=>{ if(currentMode!==mode||!map.getLayer('c-glow')) return;
        map.setPaintProperty('c-glow','line-opacity',.55); map.setPaintProperty('c-glow','line-width',7); },380);
    }catch(e){}
  });
}
function hexA(hex,a){const n=hex.replace('#','');return `rgba(${parseInt(n.slice(0,2),16)},${parseInt(n.slice(2,4),16)},${parseInt(n.slice(4,6),16)},${a})`;}
function spinLoop(){ if(!spinning)return; const c=map.getCenter(); c.lng-=0.12; map.setCenter(c); requestAnimationFrame(spinLoop); }
function stopSpin(){ spinning=false; }
['mousedown','touchstart','wheel','dragstart'].forEach(ev=>map.on(ev,stopSpin));
// └───────────────────────────────────────── /map.js ─────────────────────────────────────────┘

// ┌───────────────────────────────────────── ui.js ─────────────────────────────────────────┐
/* ---------- UI構築 ---------- */
const chipsEl=$('#chips'), biomesEl=$('#biomes'), legendEl=$('#legend');
function avatar(a,cls=''){
  const g=BIOMES[a.biome]?BIOMES[a.biome].g:['#1b3a43','#0d1b22'];
  return `<span class="av ${cls}" style="background:linear-gradient(140deg,${g[0]},${g[1]})"><span>${a.emoji}</span>`
    +`<img class="ph" loading="lazy" src="${a.photo}" alt="${esc(a.nameJa||a.nameSci||'')}" onload="this.classList.add('loaded')" onerror="this.remove()"></span>`;
}
function makeChip(a,i){
  const b=document.createElement('button');
  b.className='chip'+(SEEN.has(a.id)?' is-seen':''); b.style.animationDelay=(Math.min(i,28)*22)+'ms';   // 入場staggerは先頭だけ（末尾で110s遅延＝長時間opacity:0を防ぐ）
  b.setAttribute('aria-pressed','false'); b.dataset.id=a.id; b.dataset.biome=a.biome;
  b.dataset.q=(a.nameJa+' '+a.nameSci+' '+a.taxon+' '+a.biome).toLowerCase();
  b.dataset.no=a.no; b.dataset.status=a.status; b.dataset.cls=classOf(a);
  b.dataset.trend=trendOf(a); b.dataset.popnum=popNum(a); b.dataset.name=a.nameJa;
  b.innerHTML=avatar(a)+`<span class="meta"><span class="n">${a.nameJa}</span><span class="s">${a.nameSci}</span></span>`
    +`<span class="rk" style="background:${RARITY[a.status].color};box-shadow:0 0 8px ${RARITY[a.status].color}"></span>`
    +`<span class="seen">✓</span><span class="undisc">？</span>`;
  b.onclick=()=>selectAnimal(a.id);
  return b;
}
// 図鑑チップは全5,478枚をDOMに持つと初回構築が重い（約5.5万ノード生成＝実測4.7秒/ロングタスク23個）。
// そこで「窓描画」＝フィルタ/並びに一致する先頭 CHIP_BASE 枚だけをDOM化し、横スクロールで追加ロードする（下記）。
// buildChips は互換のため残すが「まだ窓が無ければ初期描画」するだけ（全構築はしない）。モバイルはドックを開いた時に初期描画。
// ★図鑑チップは全5,478種をDOMに持たない＝フィルタ/並びに一致する先頭 _chipLimit 枚だけ描画する「窓描画」。
//   横スクロールで端に来たら追加ロード。DOMを常に数百枚に抑え、初回の全構築(約5.5万ノード生成=約4.7秒/ロングタスク23個)を撤廃。
//   フィルタ/並びは DOM でなく ANIMALS(データ) に対して行い、一致した先頭だけを描く。要素は _chipPool で使い回し（画像の再ロード/ちらつき防止）。
const CHIP_BASE=300, CHIP_STEP=300;   // 初期に描く枚数／スクロール追加の単位
let chipsBuilt=false;                 // 初回の窓を描いたか（互換フラグ：各所の buildChips ガードに使用）
let _chipLimit=CHIP_BASE, _sortMode='no', _filtered=[];
const _chipPool=new Map();            // id→チップ要素。窓外の要素はDOMから外れるだけで破棄しない＝再表示時に再生成しない。
let _pressedId=null;                  // 現在選択中の種id。窓の描画/再利用時に aria-pressed を貼り直す（窓外プールに残る二重ハイライトを防ぐ）。
const _clsMemo=new Map(), _clsRank=new Map(clsOrder.map((k,i)=>[k,i]));
function clsOf(a){ let c=_clsMemo.get(a.id); if(c===undefined){ c=classOf(a); _clsMemo.set(a.id,c); } return c; }   // classOf(CLASS配列の線形走査=重い)を種ごと1回に。cls並べ替えの毎回再計算(=約73msロングタスク)を回避。
function _clsR(k){ const r=_clsRank.get(k); return r===undefined?-1:r; }   // 旧 clsOrder.indexOf 相当（未知=-1で先頭）
function chipMatch(a){                 // 1種がフィルタ(環境/検索/分類-傾向-保全)に一致するか
  const {biome:bm,q,facet}=filterState;
  if(bm && a.biome!==bm) return false;
  if(q && !((a.nameJa+' '+a.nameSci+' '+a.taxon+' '+a.biome).toLowerCase().includes(q))) return false;
  if(facet){ const i=facet.indexOf(':'), ft=facet.slice(0,i), fv=facet.slice(i+1);
    if(ft==='cls')    { if(clsOf(a)!==fv) return false; }
    else if(ft==='trend') { if(trendOf(a)!==fv) return false; }
    else if(ft==='status'){ if(a.status!==fv) return false; }
    else if(ft==='threat'){ if(!THREAT.includes(a.status)) return false; }
  }
  return true;
}
const _stO='CR EN VU NT LC DD';
const CHIP_CMP={
  'no':(a,b)=>(+a.no)-(+b.no),
  'pop-desc':(a,b)=>popNum(b)-popNum(a)||(+a.no)-(+b.no),
  'pop-asc':(a,b)=>{const x=popNum(a),y=popNum(b),xu=x<0,yu=y<0; if(xu&&yu)return (+a.no)-(+b.no); if(xu)return 1; if(yu)return -1; return x-y;},
  'status':(a,b)=>_stO.indexOf(a.status)-_stO.indexOf(b.status)||(+a.no)-(+b.no),
  'cls':(a,b)=>_clsR(clsOf(a))-_clsR(clsOf(b))||(+a.no)-(+b.no),
  'name':(a,b)=>String(a.nameJa||'').localeCompare(String(b.nameJa||''),'ja'),
};
function _chipEl(a,i){ let el=_chipPool.get(a.id); if(el){ el.style.animation='none'; } else { el=makeChip(a,i); _chipPool.set(a.id,el); }
  el.setAttribute('aria-pressed', a.id===_pressedId?'true':'false'); return el; }   // 使い回し要素は入場アニメを再生しない＋選択状態を貼り直す（窓外の残留を打ち消す）
function _paintWindow(){
  const end=Math.min(_chipLimit,_filtered.length), f=document.createDocumentFragment();
  for(let i=0;i<end;i++) f.appendChild(_chipEl(_filtered[i],i));
  chipsEl.replaceChildren(f);   // 窓の枚数だけをDOMに（プール要素は移動＝再生成しない）
  chipsBuilt=true;
}
// フィルタ/並びが変わった時：一致リストを再計算し窓を先頭から描き直す（DOMは先頭 CHIP_BASE 枚だけ）
function renderChips(){ _filtered=ANIMALS.filter(chipMatch).sort(CHIP_CMP[_sortMode]||CHIP_CMP.no); _chipLimit=CHIP_BASE; try{chipsEl.scrollLeft=0;}catch(e){} _paintWindow(); }
// 横スクロールで端付近＝窓を広げて次のバッチを追加描画（既存はそのまま）
function growChips(){ const shown=chipsEl.childElementCount; if(shown>=_filtered.length) return;
  _chipLimit=shown+CHIP_STEP; const end=Math.min(_chipLimit,_filtered.length), f=document.createDocumentFragment();
  for(let i=shown;i<end;i++) f.appendChild(_chipEl(_filtered[i],i)); chipsEl.appendChild(f); }
let _chipScrollQ=false;
chipsEl.addEventListener('scroll',()=>{ if(_chipScrollQ)return; _chipScrollQ=true; requestAnimationFrame(()=>{ _chipScrollQ=false;
  if(chipsEl.scrollLeft+chipsEl.clientWidth >= chipsEl.scrollWidth-800) growChips(); }); },{passive:true});
// 互換：各所から呼ばれる buildChips は「まだ窓が無ければ初期描画」だけ（全構築はしない）
function buildChips(all){ if(!chipsBuilt) renderChips(); }
// 凡例をモード連動に：概観＝国塗り「種の多さ」(緑→ゴールド)、種/環境/国選択＝IUCN保全色。
// 地図の色語彙と凡例を一致させる（概観のゴールドを「IUCN色」と誤説明していた矛盾を解消）。
let _legendMode=null;
function renderLegend(mode){
  if(!legendEl || _legendMode===mode) return;
  _legendMode=mode;
  let title, body;
  if(mode==='overview'){
    title='地図の色 — 種の多さ';
    body=`<div class="lr"><span class="sw" style="width:64px;height:9px;border-radius:3px;box-shadow:none;background:linear-gradient(90deg,#1a4a3c,#21aa8c,#f2c14e)"></span></div>
      <div class="lr" style="justify-content:space-between;color:var(--muted-2);font-size:10.5px;margin-top:-3px"><span>少ない</span><span>多い</span></div>
      <div class="lr" style="color:var(--muted-2);font-size:11px">国ごとの図鑑掲載種の数</div>`;
  } else {
    title='生息数のめやす（IUCN保全状況）';
    const used=[...new Set(ANIMALS.map(a=>a.status))].sort((a,b)=>'LC NT VU EN CR DD NE'.indexOf(a)-'LC NT VU EN CR DD NE'.indexOf(b));
    body=used.map(s=>{const r=RARITY[s]; return `<div class="lr" style="color:${r.color}"><span class="sw" style="background:${r.color}"></span><b>${r.band}</b><span style="margin-left:auto;color:var(--muted-2)">${s}</span></div>`;}).join('');
  }
  legendEl.innerHTML=`<div class="lt">${title}</div>${body}`
    +`<div class="lf">地図の<b>黄〜赤のメッシュ</b>は GBIF の実観測地点。<b>ズームで細かく</b>なります。🛰️で表示切替。</div>`
    +`<button type="button" class="lhelp">🛟 保全状況（IUCN）とは？</button>`;
  const h=legendEl.querySelector('.lhelp'); if(h) h.onclick=()=>openRedlist();
}
function initCatalog(){
Object.keys(BIOMES).forEach(bm=>{
  const b=document.createElement('button');
  b.className='bm'; b.setAttribute('aria-pressed','false'); b.dataset.bm=bm;
  b.innerHTML=`<span class="e">${BIOMES[bm].e}</span>${bm}`; b.onclick=()=>selectBiome(bm);
  biomesEl.appendChild(b);
});
const allBtn=document.createElement('button'); allBtn.className='bm'; allBtn.innerHTML='✺ ぜんぶ'; allBtn.onclick=resetAll; biomesEl.appendChild(allBtn);
renderLegend(currentMode&&currentMode.type==='overview'?'overview':'status');   // 起動時のモードに合わせて凡例を描く（以後は各paint関数が切替）
buildSortFilter();
// チップ本体：モバイルはドックを開くまで作らない。デスクトップも初期描画をブロックしないよう
// アイドルで構築（近所/地図を先に軽く出す）。図鑑操作(検索/環境/並び替え)は各入口で buildChips を保証。
if(matchMedia('(max-width:640px)').matches){ chipsEl.innerHTML=''; }
else { (window.requestIdleCallback||(f=>setTimeout(()=>f(),300)))(()=>buildChips(),{timeout:2200}); }
} // initCatalog
// 種データ到着後：採番 → 図鑑UI構築 → 「準備完了」を通知（地図側はこれを await して描画）
__spData.then(d=>{ ANIMALS=d.animals; ANIMALS.forEach((a,i)=>{ a.no=i+1; a.photo=photoURL(a.photo); }); initCatalog(); __speciesDone(); })
        .catch(e=>{ console.error(e); if(typeof bootFail==='function') bootFail('種データを読み込めませんでした。'); __speciesDone(); });

// 詳細データ（stats/desc/photoCred）を初回だけ遅延ロードして各 animal にマージ。種カードを開く時に await する。
let __detailReady=null;
function ensureDetail(){
  if(__detailReady) return __detailReady;
  __detailReady = Promise.all([__speciesReady, fetch('data/species-detail.json').then(r=>{ if(!r.ok) throw new Error('species-detail.json '+r.status); return r.json(); })])
    .then(([,d])=>{ const D=d.detail||{}; PHOTO_CRED=d.photoCred||{}; for(const a of ANIMALS){ const x=D[a.id]; if(x){ a.stats=x.stats; a.desc=x.desc; if(x.eco)a.eco=x.eco; if(x.human)a.human=x.human; if(x.cook)a.cook=x.cook; if(x.wiki)a.wiki=x.wiki; } } })
    .catch(e=>{ console.error(e); });   // 失敗してもカードは基本情報＋フォールバックで表示（下の renderAnimalCard が防御）
  return __detailReady;
}

/* ---------- セレクション ---------- */
function pressChip(id){ _pressedId=id; chipsEl.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.id===id?'true':'false')); }   // 選択idを保持＝以後の窓再描画で aria-pressed を正しく貼り直す
function pressBiome(bm){ biomesEl.querySelectorAll('.bm').forEach(c=>c.setAttribute('aria-pressed',c.dataset.bm===bm?'true':'false')); }
function filterChips(bm){ filterState.biome=bm; applyFilters(); }
// 環境・検索・分類/傾向/保全 をAND結合して一致リストを作り、窓を描き直す（DOMは先頭数百枚だけ＝全走査しない）
function applyFilters(){ renderChips(); }
// 検索の連続入力用：renderChips を毎キーストロークでなく入力停止後にまとめて実行（トレイリングデバウンス）。
let _filterT=null;
function scheduleFilter(){ clearTimeout(_filterT); _filterT=setTimeout(()=>{ _filterT=null; renderChips(); }, 130); }
// チップの並び替え：DOMでなくデータを並べ替え、窓を先頭から描き直す。
function sortChips(mode){ _sortMode=mode||'no'; renderChips(); }
// 並び替え/絞り込みセレクトを生成（実データに存在する分類・保全状況のみ）
function buildSortFilter(){
  const sortSel=$('#sortSel'), facetSel=$('#facetSel');
  sortSel.innerHTML=`<option value="no">№順（標準）</option>`
    +`<option value="pop-desc">生息数 多い順</option>`
    +`<option value="pop-asc">生息数 少ない順</option>`
    +`<option value="status">絶滅危機が高い順</option>`
    +`<option value="cls">分類ごと</option>`
    +`<option value="name">名前順（あいうえお）</option>`;
  const clsP=clsOrder.filter(k=>ANIMALS.some(a=>classOf(a)===k));
  const stL={CR:'近絶滅 CR',EN:'絶滅危惧 EN',VU:'危急 VU',NT:'準絶滅危惧 NT',LC:'軽度懸念 LC',DD:'データ不足 DD'};
  const stP='CR EN VU NT LC DD'.split(' ').filter(s=>ANIMALS.some(a=>a.status===s));
  facetSel.innerHTML=`<option value="">🔎 すべて表示</option>`
    +`<optgroup label="分類で">`+clsP.map(k=>`<option value="cls:${k}">${k}</option>`).join('')+`</optgroup>`
    +`<optgroup label="傾向で"><option value="trend:up">↑ 増えている</option><option value="trend:down">↓ 減っている</option><option value="trend:stable">→ 横ばい</option></optgroup>`
    +`<optgroup label="保全状況で">`
      +(stP.some(s=>THREAT.includes(s))?`<option value="threat:1">⚠ 絶滅危惧（CR・EN・VU）</option>`:'')
      +stP.map(s=>`<option value="status:${s}">${stL[s]}</option>`).join('')+`</optgroup>`;
  sortSel.onchange=()=>{ sortChips(sortSel.value); };
  facetSel.onchange=()=>{ filterState.facet=facetSel.value; applyFilters(); };
}
function markSeen(id){ if(!SEEN.has(id)){ SEEN.add(id); localStorage.setItem('biosphere_seen',JSON.stringify([...SEEN])); const ch=_chipPool.get(id); if(ch)ch.classList.add('is-seen'); updateDex(); celebrate(id); } }   // プール要素を更新＝窓外でも再表示時に発見済み表示が保たれる
function saveBadges(){ try{ localStorage.setItem('biosphere_badges',JSON.stringify([...BADGES])); }catch(e){} }
// コンプ演出：全種＞生息環境ごと＞保全状況ごと。既達成はBADGESで一度きり
function celebrate(id){
  const a=ANIMALS.find(x=>x.id===id); if(!a)return;
  if(SEEN.size>=ANIMALS.length){ if(!BADGES.has('ALL')){ BADGES.add('ALL'); saveBadges(); confetti(); toast('🏆',`図鑑コンプリート！全${ANIMALS.length}種を旅しました`,4600); } return; }
  const list=ANIMALS.filter(x=>x.biome===a.biome);
  if(list.every(x=>SEEN.has(x.id)) && !BADGES.has('biome:'+a.biome)){ BADGES.add('biome:'+a.biome); saveBadges();
    toast(BIOMES[a.biome].e, `${a.biome} の生きものをすべて発見！🎖️`, 3400); return; }
  const slist=ANIMALS.filter(x=>x.status===a.status);
  if(slist.every(x=>SEEN.has(x.id)) && !BADGES.has('status:'+a.status)){ BADGES.add('status:'+a.status); saveBadges();
    toast(RARITY[a.status].gem, `「${RARITY[a.status].band}（${a.status}）」をすべて発見！🎖️`, 3400); return; }
  // 到達可能なマイルストーン（5,348種でコンプは非現実的なので早期の達成感を用意）。一度きり・BADGESで管理。
  const MILE=[1,10,25,50,100,250,500,1000,2000,3000];
  const n=SEEN.size, hit=MILE.filter(m=>m<=n).pop();
  if(hit && !BADGES.has('n:'+hit)){ BADGES.add('n:'+hit); saveBadges(); const next=MILE.find(m=>m>n);
    confetti(); toast('🎉', (hit===1?'はじめての発見！':`${hit}種を発見！`)+(next?` 次の節目まであと${next-n}種`:' 図鑑マスター級！'), 3800); }
}
function confetti(){
  const cols=['#34d8c6','#f2c14e','#b072ff','#ff9a8a','#5fd39a'];
  for(let i=0;i<30;i++){ const d=document.createElement('div'); d.className='confetti';
    d.style.left=(Math.random()*100)+'vw'; d.style.background=cols[i%cols.length];
    d.style.animationDelay=(Math.random()*0.7).toFixed(2)+'s'; d.style.width=(6+Math.random()*6).toFixed(0)+'px';
    document.body.appendChild(d); setTimeout(()=>d.remove(),3600); }
}
function updateDex(){ const n=SEEN.size,t=ANIMALS.length; $('#dexNum').textContent=`${n}/${t}`; $('#dex').querySelector('.ring').style.setProperty('--p',Math.round(n/t*100)); $('#dexEmoji').textContent=n>=t?'🏆':(n>0?'🐾':'🧭'); }

async function selectAnimal(id){
  const a=await DATA.getAnimal(id); if(!a)return;
  removeNearbyVisuals();
  currentMode={type:'animal',id}; currentAnimal=a;
  pressChip(id); pressBiome(null); filterChips(null);
  paintAnimal(a); flyTo(a.focus.c,a.focus.z); await ensureDetail();
  if(currentAnimal!==a) return;   // ★詳細JSON(初回~1.8MB)ロード中に別へ遷移(生息環境/近く/別種)していたら、この続き(カード描画)を破棄＝取り残し(生息環境アイコン等)防止
  renderAnimalCard(a); markSeen(id);
  try{ history.replaceState(null,'','#'+id); }catch(e){}   // 共有用ディープリンク
  setMode(animalModeText(a)); showYearbar(gbifOn);
}
async function selectBiome(bm){
  if(currentMode&&currentMode.type==='biome'&&currentMode.bm===bm){ resetAll(); return; }   // ③ 同じ生息環境をもう一度押す＝解除（地図の色分けと絞り込みを元に戻す＝「✺ ぜんぶ」と同じ）
  removeNearbyVisuals();
  currentMode={type:'biome',bm}; currentAnimal=null;
  pressBiome(bm); pressChip(null); filterChips(bm); paintBiome(bm); closePanel(); showYearbar(false);   // filterChips が窓を描き直す（その環境の一致先頭だけ）
  const list=await DATA.getAnimalsByBiome(bm);
  setMode(`${BIOMES[bm].e} ${bm} の住人 ${list.length}種`);
  const tz = list[0] ? Math.max(1.6, list[0].focus.z-0.8) : 2;   // 到着ズーム＝数え上げの基準（出発地でなく着地の地図の広さで数を決める）
  if(list[0]) flyTo(list[0].focus.c, tz);
  spawnBiomeCreatures(bm, tz);   // ④ その環境の動物アイコンを世界地図に散らす（数は着地の地図の広さ＝ズームに応じて）
}
async function showCountry(code, lngLat){
  if(!code)return; removeNearbyVisuals(); currentMode={type:'country',code}; currentAnimal=null; pressChip(null); showYearbar(false);
  const animals=await DATA.getAnimalsByCountry(code); paintCountry(code); renderCountryCard(code,animals);
  setMode(`${ccFlag(code)} ${ccName(code)} に棲むいきもの`);
  const center = lngLat ? [lngLat.lng,lngLat.lat] : countryCentroid(code);
  if(center){ stopSpin(); map.flyTo({center,zoom:3.4,speed:.8,curve:1.5,essential:true}); pulseArrival(); }
  fetchLocalSpecies(code);
}
// 国の重心（bbox中心）を求める
function countryCentroid(code){
  if(!countryGeo)return null;
  const f=countryGeo.features.find(ft=>ft.properties[CODE_PROP]===code); if(!f)return null;
  let minx=180,miny=90,maxx=-180,maxy=-90;
  const walk=(co)=>{ if(typeof co[0]==='number'){ if(co[0]<minx)minx=co[0]; if(co[0]>maxx)maxx=co[0]; if(co[1]<miny)miny=co[1]; if(co[1]>maxy)maxy=co[1]; } else co.forEach(walk); };
  walk(f.geometry.coordinates);
  return [(minx+maxx)/2,(miny+maxy)/2];
}
// 動物の分布国へズーム（その種の詳細メッシュを保ったまま寄る）
function flyCountry(code){ const c=countryCentroid(code); if(c){ stopSpin(); map.flyTo({center:c,zoom:4,speed:.85,curve:1.5,essential:true}); } }
// GBIF実データ：その国で多く記録される脊椎動物（taxonKey=44=脊索動物）
// 堅牢化：localStorageキャッシュで再訪を即時表示＋背景更新／連打はデバウンス／失敗・空でも図鑑情報は維持
const LS_GBIF='biosphere_gbif_';   // 国別ファセットのキャッシュ接頭辞（A2コード）
function gbifCacheGet(a2){ try{ const o=JSON.parse(localStorage.getItem(LS_GBIF+a2)||'null'); if(o&&(Date.now()-o.t)<6048e5) return o.c; }catch(e){} return null; } // 7日有効
function gbifCacheSet(a2,c){ try{ localStorage.setItem(LS_GBIF+a2,JSON.stringify({t:Date.now(),c})); }catch(e){} }
function renderLocalSpecies(el,counts,a2){
  el.innerHTML=counts.map(c=>{const disp=c.name.split(' ').slice(0,2).join(' ');
    return `<a class="locrow" target="_blank" rel="noopener" href="https://www.gbif.org/occurrence/search?country=${a2}&q=${encodeURIComponent(c.name)}"><span class="locav" data-sci="${encodeURIComponent(disp)}">🐾</span><span class="ln2">${esc(disp)}</span><span class="cnt2">${fmtN(c.count)}件 ↗</span></a>`;}).join('');
  // iNaturalistから実写真サムネを後追いで挿入
  el.querySelectorAll('.locav').forEach(async av=>{
    try{ const sci=decodeURIComponent(av.dataset.sci);
      const d=await (await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sci)}&rank=species&per_page=1`)).json();
      const ph=d.results&&d.results[0]&&d.results[0].default_photo&&d.results[0].default_photo.square_url;
      if(ph){ av.innerHTML=`<img src="${esc(ph)}" alt="${esc(sci)}" onload="this.style.opacity=1">`; }
    }catch(e){}
  });
}
let localTimer=null;
function fetchLocalSpecies(code){
  const el=document.getElementById('localspecies'); if(!el)return;
  const a2=A3toA2[code];
  if(!a2){ el.innerHTML='<span class="muted">この地域の実データは取得できませんでした。</span>'; return; }
  const cached=gbifCacheGet(a2);
  if(cached && cached.length){ renderLocalSpecies(el,cached,a2); }           // キャッシュを即時表示（再訪が速い）
  else { el.innerHTML='<span class="muted">🛰️ 実データを取得中…</span>'; }
  clearTimeout(localTimer);                                                   // 連打は最後の1回だけ叩く（レート配慮）
  localTimer=setTimeout(async()=>{
    try{
      const r=await fetch(`https://api.gbif.org/v1/occurrence/search?country=${a2}&taxonKey=44&hasCoordinate=true&limit=0&facet=scientificName&facetLimit=8`);
      const d=await r.json();
      const counts=(d.facets&&d.facets[0]&&d.facets[0].counts)||[];
      if(document.getElementById('localspecies')!==el) return;               // 別の国へ切替済みなら中断
      if(!counts.length){ if(!cached||!cached.length) el.innerHTML='<span class="muted">記録が見つかりませんでした。</span>'; return; }
      gbifCacheSet(a2,counts); renderLocalSpecies(el,counts,a2);              // 最新で上書き＆キャッシュ更新
    }catch(e){
      if(document.getElementById('localspecies')!==el) return;
      if(!cached||!cached.length) el.innerHTML='<span class="muted">実データ取得に失敗しました（オフライン？）。図鑑情報はそのままご覧いただけます。</span>';
    }
  },250);
}
function fmtN(n){ return n>=1000? (n/1000).toFixed(n>=10000?0:1)+'k' : String(n); }
function resetAll(){ ANALYTICS.track('world_opened'); pressChip(null); pressBiome(null); removeNearbyVisuals();
  filterState.biome=null; filterState.facet=''; filterState.q='';
  const ss=$('#sortSel'),fs=$('#facetSel'),sr=$('#search'); if(fs)fs.value=''; if(sr)sr.value=''; if(ss)ss.value='no';
  sortChips('no'); closePanel(); drawOverview();   // sortChips が窓を先頭から描き直す（フィルタ解除済み＝全種の先頭CHIP_BASE枚）
  map.flyTo({center:[18,16],zoom:1.45,speed:.7,curve:1.5,essential:true}); }
function explore(){
  // まだ見ていない種を優先してランダムに（全部見たら全体から）
  const pool = ANIMALS.filter(a=>!SEEN.has(a.id));
  const from = pool.length ? pool : ANIMALS;
  const pick = from[Math.floor(Math.random()*from.length)];
  toast('🎲', `気ままに ${pick.nameJa} の世界へ…`, 2200);
  selectAnimal(pick.id);
}

/* ---------- パネル ---------- */
const panelEl=$('#panel');
function openPanel(){ panelEl.classList.add('open'); document.body.classList.add('panel-open'); }   // panel-open＝モバイルで下部シート表示中→ドックを隠して被り防止
function closePanel(){ panelEl.classList.remove('open'); document.body.classList.remove('panel-open'); }
// モバイルのシート高さ：近くの一覧/詳細は中間（地図＋生き物を上に見せる）、種/国カードは通常（full）。
function panelSheet(mid){ panelEl.classList.toggle('sheet-mid', !!mid); }
// head を渡すと（近くの生き物→📖図鑑タブ経由）上部にタブ＋分布メッシュトグルを差し込む。通常の種選択では head 無し＝従来どおり。
function renderAnimalCard(a, head){
  const r=RARITY[a.status], g=BIOMES[a.biome]?BIOMES[a.biome].g:['#1b3a43','#0d1b22'], tm=TREND_META[trendOf(a)];
  const cred=PHOTO_CRED[a.id]||{by:'Wikimedia Commons',lic:''};
  const st=a.stats||{size:'—',weight:'—',diet:'—',life:'—'};   // 詳細ロード前/失敗時のフォールバック
  panelEl.innerHTML=`
    <button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button>
    <div class="grab"></div>
    ${head||''}
    <div class="hero" style="background:linear-gradient(140deg,${g[0]},${g[1]})">
      <div class="emojibg">${a.emoji}</div>
      <img class="bgph" src="${a.photo}" alt="${a.nameJa}" onload="this.classList.add('loaded')" onerror="this.remove()">
      <div class="scrim"></div>
      <div class="no">№ ${String(a.no).padStart(3,'0')}</div>
      <div class="htext"><div class="nm">${a.nameJa}</div><div class="sci">${a.nameSci}</div></div>
      <a class="phcred" href="${commonsPageURL(a.photo)}" target="_blank" rel="noopener" title="写真の出典（Wikimedia Commons）">📷 ${cred.by}${cred.lic?(' · '+cred.lic):''}</a>
    </div>
    <div class="pbody">
      <div class="row1"><span class="tax">🧬 ${a.taxon}</span><span class="tax">${BIOMES[a.biome].e} ${a.biome}</span><button class="tax pshare" onclick="shareFigureCard('${a.id}',this)">🔗 共有</button></div>
      <button class="nbtn wide seenbtn" id="seenBtn" onclick="openSeen('${a.id}')">${seenBtnLabel(a.id)}</button>
      ${head?`<button class="nbtn wide${figGbifOn?' on':''}" id="figDistBtn" onclick="toggleFigDist(this)">${figGbifOn?'🛰️ 分布メッシュを消す':'🛰️ この地点の分布メッシュを表示'}</button>`:''}
      <div class="flavor2" data-fid="${esc(a.id)}"></div>
      <div class="ndsec" id="figsound" style="margin:2px 0 10px"><button class="nbtn wide" onclick="playFigureSound('${a.id}',this)">🔊 鳴き声を聞く</button></div>
      <div class="seclab">生息地 — ${a.range.length}地域（タップで寄る） <span class="ln"></span></div>
      <div class="geos">${a.range.map(c=>`<button class="geo" onclick="flyCountry('${c}')"><span class="fl">${ccFlag(c)}</span>${ccName(c)}</button>`).join('')}</div>
      <button class="nbtn wide moretoggle" id="cardMoreBtn" aria-expanded="false" aria-controls="cardMore" onclick="toggleCardMore(this)">▾ もっと詳しく（学名・大きさ・保全・実観測…）</button>
      <div class="moredetails" id="cardMore" hidden>
        ${!head?`<button class="nbtn wide${gbifOn?' on':''}" id="cardDistBtn" onclick="toggleAnimalDist(this)">${distBtnLabel(a,gbifOn)}</button>`:''}
        <div class="rare" style="background:${hexA(r.color,.1)}">
          <span class="glowbar" style="background:${r.color};box-shadow:0 0 14px ${r.color}"></span>
          <span class="gem" style="color:${r.color}">${r.gem}</span>
          <span class="popwrap"><span class="poplabel">推定生息数（野生）</span><span class="popline"><span class="popval" style="color:${r.color}">${popOf(a)}</span><span class="trend" style="color:${tm.c}">${tm.a} ${tm.t}</span></span><span class="popsrc">出典 <a href="${iucnURL(a)}" target="_blank" rel="noopener">IUCN ↗</a><a href="${gbifURL(a)}" target="_blank" rel="noopener">GBIF ↗</a></span></span>
          <button type="button" class="iucn" onclick="openRedlist('${a.status}','${a.id}')" title="保全状況（IUCNレッドリスト）の意味を見る"><span class="code" style="background:${r.color}">${a.status}<span class="qm">?</span></span><span class="jp">${r.jp}・${r.band}</span></button>
        </div>
        <div class="stats">
          <div class="stat"><div class="k">📏 大きさ</div><div class="v">${st.size}</div></div>
          <div class="stat"><div class="k">⚖️ 体重</div><div class="v">${st.weight}</div></div>
          <div class="stat"><div class="k">🍖 食性</div><div class="v">${st.diet}</div></div>
          <div class="stat"><div class="k">⏳ 寿命</div><div class="v">${st.life}</div></div>
        </div>
        ${['CR','EN','VU','NT','DD'].includes(a.status)?`<div class="conserv">
          <div class="cvhead">🛡 おもな脅威と保全 <span class="cvst" style="color:${r.color}">${r.jp}（${a.status}）</span></div>
          <div class="cvtags">${threatsOf(a).map(t=>`<span class="cvtag">${t}</span>`).join('')}</div>
          <div class="cvlinks">${conservLinks(a).map(x=>`<a href="${x.u}" target="_blank" rel="noopener">${x.l} ↗</a>`).join('')}<button type="button" class="cvmore" onclick="openRedlist('${a.status}','${a.id}')">保全状況とは？</button></div>
        </div>`:''}
        <div class="gbifnote">🛰️ 地図の<b>メッシュ</b>＝${isWideBasis(a)?'GBIFに記録された地点':'GBIFの実観測地点'}（${a.nameSci}）。上の「🛰️ ${distName(a)}」で表示でき、<b>ズームするほど分布が細かく</b>見えます。${isWideBasis(a)?'<br>🐟 海や川の生きものは人の目撃記録が少ないため、<b>研究者の標本・調査記録も含めて</b>表示しています（化石は除く）。':''}</div>
        ${MIGRATION[a.id]?`<div class="gbifnote mignote">🧭 <b>季節移動</b>：${MIGRATION[a.id].note}。地図に<span style="color:#ffd45e;font-weight:700">繁殖↔越冬の経路</span>（模式）を表示中。</div>`:''}
      </div>
    </div>`;
  panelSheet(false); openPanel();
  fillFlavor(a);
}
// 図鑑ドックの「⚙ 並び替え・絞り込み」＝多段の並び替え(生息数順/絶滅危機順/分類…)＋絞り込みを開閉（既定は畳む＝No順・docs/design/11-B）。
function toggleSortFilter(btn){
  const d=document.getElementById('sortfilter'); if(!d) return;
  if(d.hasAttribute('hidden')){ d.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); }
  else{ d.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); }
}
// 図鑑カードの「▾ もっと詳しく」＝二次情報（学名/stats/推定生息数/保全/出典/🛰️実観測トグル）を開閉。
// ★写真・名前・👀見た！・3フレーバー・生息地は常に表示（docs/design/11・"こだわり"の3フレーバーは隠さない）。
function toggleCardMore(btn){
  const d=document.getElementById('cardMore'); if(!d) return;
  if(d.hasAttribute('hidden')){ d.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); btn.innerHTML='▴ 詳細をとじる'; }
  else{ d.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); btn.innerHTML='▾ もっと詳しく（学名・大きさ・保全・実観測…）'; }
}
/* ---------- フレーバー2本立て（🌿生態 / 👤人との関わり） ---------- */
// curated種（species.jsonにeco/humanを静的保持）は即表示。非curated種はまずdescを🌿に出し、
// ja Wikipediaを非同期取得して差し替える（スピナー→挿入）。捏造しない：出典に無いことは載せない。
function flavBlocks({eco,human,cook,src,loading}){
  let h='';
  h+=`<div class="flavblk eco"><div class="flavh">🌿 生態</div><div class="flavtx">${esc(eco)||'—'}</div></div>`;
  if(human) h+=`<div class="flavblk human"><div class="flavh">👤 人との関わり</div><div class="flavtx">${esc(human)}</div></div>`;
  if(cook) h+=`<div class="flavblk cook"><div class="flavh">🍴 調理法・味</div><div class="flavtx">${esc(cook)}</div></div>`;
  if(loading) h+=`<div class="flavmeta"><span class="flavspin"></span>Wikipediaから生態・人との関わりを取得中…</div>`;
  else if(src) h+=`<div class="flavmeta">出典 <a href="${esc(src)}" target="_blank" rel="noopener">Wikipedia ↗</a></div>`;
  return h;
}
function fillFlavor(a){
  const el=panelEl.querySelector('.flavor2'); if(!el) return;
  if(a.eco||a.human){ el.innerHTML=flavBlocks({eco:a.eco||a.desc||'', human:a.human||'', cook:a.cook||'', src:a.wiki||''}); return; }  // 生態/人との関わりがcurated＝即表示
  // eco/human無し：desc仮表示＋（あれば）curated調理法。Wikipediaで生態/人との関わりを取得して差し替え（🍴はcurated優先で温存）
  el.innerHTML=flavBlocks({eco:a.desc||'', human:'', cook:a.cook||'', loading:true});
  loadWikiFlavor(a, el);
}
function applyWikiFlavor(el, a, res){
  if(!el.isConnected) return;
  const eco=(res&&res.eco)?res.eco:(a.desc||'');
  const human=(res&&res.human)?res.human:'';
  const cook=a.cook?a.cook:((res&&res.cook)?res.cook:'');   // curated調理法を優先。無ければオンデマンド抽出
  const src=a.wiki?a.wiki:((res&&res.url)?res.url:'');
  el.innerHTML=flavBlocks({eco,human,cook,src});
}
function loadWikiFlavor(a, el){
  const c=wikiFlavorGet(a.id); if(c){ applyWikiFlavor(el,a,c); return; }
  wikiFlavorFetch(a).then(res=>{ if(res) wikiFlavorSet(a.id,res); applyWikiFlavor(el,a,res); })
    .catch(()=>{ if(el.isConnected) el.innerHTML=flavBlocks({eco:a.desc||'', human:'', cook:a.cook||'', src:a.wiki||''}); });
}
// localStorage キャッシュ（7日）。往復を1種1回に。
const LS_WIKI='biosphere_wikiflav_';
function wikiFlavorGet(id){ try{const o=JSON.parse(localStorage.getItem(LS_WIKI+id)||'null'); if(o&&(Date.now()-o.t)<6048e5) return o.v;}catch(e){} return null; }
function wikiFlavorSet(id,v){ try{localStorage.setItem(LS_WIKI+id,JSON.stringify({t:Date.now(),v}));}catch(e){} }
// ja Wikipedia を CORS(origin=*) で取得し、節を🌿/👤に振り分け。生態=リード or 生態節、人との関わり=節ありのみ。
const WIKI_EXCL=/脚注|注釈|出典|参考文献|参考図書|関連項目|外部リンク|画像|ギャラリー|分類|学名|シノニム|亜種|語源|命名|名称|表記/;
const WIKI_ECO=/生態|繁殖|生活|食性|食う|捕食|狩|行動|社会|群れ|天敵|コミュニ|鳴き|発生|産卵|回遊|渡り|越冬|冬眠|生育|幼虫|幼生|成虫|蛹|変態|習性|生殖|営巣|生息/;
const WIKI_HUM=/人間|人と|利用|文化|飼育|栽培|保全|保護|絶滅|減少|脅威|漁|狩猟|養殖|農業|園芸|害|益|駆除|被害|ペット|家畜|採集|象徴|神話|信仰|伝説|民俗|研究史|歴史|関係|条約|レッドリスト|ワシントン/;
const WIKI_COOK=/食用|料理|食味|調理|美味|食材|かば焼|蒲焼|刺身|食文化|味わい|珍味|食べ方|グルメ/;   // 🍴調理法・味の節
function wikiSentences(t,maxCh,maxN){ // 先頭からmaxN文・maxCh字まで
  if(!t) return '';
  const s=t.replace(/\s+/g,' ').trim();
  const parts=s.split(/(?<=。)/); let out='',n=0;
  for(const p of parts){ const q=p.trim(); if(!q) continue; if(n>=maxN||(out.length+q.length)>maxCh) break; out+=q; n++; }
  if(!out) out=s.slice(0,maxCh);
  return out.trim();
}
function wikiParse(extract){
  const lines=extract.split('\n'); const secs=[]; let cur={title:'(lead)',text:[]};
  for(const ln of lines){ const m=ln.match(/^(={2,})\s*(.+?)\s*\1\s*$/); if(m){ secs.push(cur); cur={title:m[2].trim(),text:[]}; } else cur.text.push(ln); }
  secs.push(cur);
  let lead='',ecoSec='',humSec='',cookSec='';
  for(const s of secs){ const tx=s.text.join('\n').replace(/\n{2,}/g,'\n').trim(); if(!tx) continue;
    if(s.title==='(lead)'){ lead=tx; continue; }
    if(WIKI_EXCL.test(s.title)) continue;
    if(!cookSec && WIKI_COOK.test(s.title)) cookSec=tx;        // 🍴 調理法・味（食用/料理/食味 等の節を優先）
    else if(!humSec && WIKI_HUM.test(s.title)) humSec=tx;
    else if(!ecoSec && WIKI_ECO.test(s.title)) ecoSec=tx;
  }
  const eco=wikiSentences(ecoSec||lead, 140, 3);
  const human=humSec? wikiSentences(humSec, 130, 2) : '';
  const cook=cookSec? wikiSentences(cookSec, 120, 2) : '';
  return {eco,human,cook};
}
async function wikiFetchExtract(title){
  const u='https://ja.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts|info&inprop=url&explaintext=1&exsectionformat=wiki&redirects=1&titles='+encodeURIComponent(title);
  const r=await fetch(u); if(!r.ok) throw new Error('wiki '+r.status);
  const j=await r.json(); const p=Object.values(j.query.pages)[0];
  if(p.missing!==undefined) return null;
  return {title:p.title, url:p.fullurl, extract:p.extract||''};
}
function wikiFlavorFetch(a){
  return dedupe('wikiflav:'+a.id, async()=>{
    let e=null;
    try{ e=await wikiFetchExtract(a.nameJa); }catch(err){}
    if((!e || (e.extract||'').length<500) && a.nameSci){ try{ const e2=await wikiFetchExtract(a.nameSci); if(e2&&(e2.extract||'').length>((e&&e.extract)?e.extract.length:0)) e=e2; }catch(err){} }
    if(!e) return null;
    const {eco,human,cook}=wikiParse(e.extract);
    return {eco,human,cook,url:e.url};
  });
}
function renderCountryCard(code,animals){
  const rows=animals.length? animals.map(a=>{const r=RARITY[a.status];
    return `<button class="cc-item" onclick="selectAnimal('${a.id}')">${avatar(a)}
      <span class="info"><span class="n">${a.nameJa}</span><span class="s">${a.nameSci}</span></span>
      <span class="rkbadge" style="background:${r.color}">${r.band}</span></button>`;}).join('')
    : `<div class="cc-empty">図鑑の${ANIMALS.length}種ではこの地域の登録がありません。<br>下の<b>GBIF実データ</b>には、その土地で実際に記録された生きものが出ます。</div>`;
  panelEl.innerHTML=`<button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button><div class="grab"></div>
    <div class="cc-head"><div class="lbl">この土地に棲む</div>
      <div class="cname"><span class="cflag">${ccFlag(code)}</span>${ccName(code)}</div>
      <div class="cnt">${animals.length?`図鑑の${animals.length}種が確認されています`:'図鑑では登録なし'}</div></div>
    ${animals.length?'<div class="seclab" style="margin:4px 16px 8px">🐾 図鑑の種 <span class="ln"></span></div>':''}
    <div class="cc-list">${rows}</div>
    <div class="seclab" style="margin:8px 16px 9px">🛰️ GBIF実データ：この国で多く記録される生きもの <span class="ln"></span></div>
    <div id="localspecies" class="locsp">実データを取得中…</div>`;
  panelSheet(false); openPanel();
}
function shareAnimal(id){
  const url = location.origin + location.pathname + '#' + id;
  if(navigator.share){ navigator.share({title:'BIOSPHERE — いきもの分布アトラス', url}).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(url).then(()=>toast('🔗','リンクをコピーしました',1900)).catch(()=>toast('🔗',url,3200)); }
  else { toast('🔗',url,3200); }
}
function openAbout(){ $('#about').removeAttribute('hidden'); }
function closeAbout(){ $('#about').setAttribute('hidden',''); }
/* レッドリスト解説モーダル：階段で意味を示し、種を指定するとその位置を強調＋IUCN導線。下部に図鑑の危機サマリ。 */
function openRedlist(status, id){
  const a = id ? ANIMALS.find(x=>x.id===id) : null;
  const cur = status || (a && a.status) || null;
  let banner='';
  if(a){
    const m=RL[a.status]||{jp:'',color:'#888'};
    banner=`<div class="rl-now" style="border-left-color:${m.color}">
      <span class="em">${a.emoji}</span>
      <span class="t"><b>${a.nameJa}</b> は現在<br><span class="nc" style="background:${m.color}">${a.status}</span><b>${m.jp}</b></span>
      <a class="ln" href="${iucnURL(a)}" target="_blank" rel="noopener">IUCNで見る ↗</a></div>`;
  }
  let rows='', threatOpened=false;
  REDLIST.forEach(r=>{
    if(THREAT.includes(r.code) && !threatOpened){ rows+=`<div class="rl-glabel">⚠ 絶滅危惧種（Threatened）</div>`; threatOpened=true; }
    const isCur=cur===r.code, th=THREAT.includes(r.code);
    const lb=(isCur||th)?r.color:'transparent';
    const hi=isCur?`background:${hexA(r.color,.15)};border-color:${r.color};box-shadow:0 0 0 1px ${r.color} inset;`:'';
    rows+=`<div class="rl-row${isCur?' cur':''}" style="border-left-color:${lb};${hi}">
      <span class="code" style="background:${r.color}">${r.code}</span>
      <span class="tx"><b>${r.jp}</b><i>${r.en}</i><span class="mean">${r.mean}</span></span></div>`;
  });
  const cnt={}; ANIMALS.forEach(x=>cnt[x.status]=(cnt[x.status]||0)+1);
  const nThreat=THREAT.reduce((s,c)=>s+(cnt[c]||0),0);
  const chips=REDLIST.filter(r=>cnt[r.code]).map(r=>
    `<button class="rl-chip" style="border-left-color:${r.color}" onclick="filterStatus('${r.code}')">${r.code} ${r.jp.split('（')[0]}<b style="color:${r.color}">${cnt[r.code]}</b></button>`).join('');
  const summary=`<div class="rl-summary">
    <div class="rl-sumtitle">この図鑑の <b>${ANIMALS.length}種</b> のうち <b style="color:#ffb02e">${nThreat}種</b> が<b>絶滅の危機</b>（CR・EN・VU）にあります。バッジを押すと図鑑をしぼれます。</div>
    <button class="rl-threatbtn" onclick="filterThreat()">⚠ 絶滅危惧の ${nThreat}種 をしぼって見る　→</button>
    <div class="rl-sumchips">${chips}</div></div>`;
  $('#rlBody').innerHTML = banner
    + `<p class="rl-lead">国際自然保護連合（IUCN）の<b>レッドリスト</b>は、生きものの絶滅リスクを評価した世界共通のものさし。上ほど危機的で、<b>CR・EN・VU</b>をまとめて「絶滅危惧種」と呼びます。</p>`
    + `<div class="rl-ladder">${rows}</div>`
    + summary;
  $('#redlist').removeAttribute('hidden');
}
function closeRedlist(){ $('#redlist').setAttribute('hidden',''); }
// モバイルで図鑑ドックが畳まれたまま絞り込むと「絞ったのに何も見えない」になるため、ドックを開きチップを構築してから適用する。
function ensureCatalogVisible(){
  if(typeof buildChips==='function') buildChips(true);   // 保全状況で絞る＝全種必要（デスクトップも全構築）
  if(!matchMedia('(max-width:640px)').matches) return;
  const d=$('#dock'); if(d&&!d.classList.contains('open')){ d.classList.add('open'); const t=$('#dockToggle'); if(t)t.setAttribute('aria-expanded','true'); } }
function filterStatus(code){ const fs=$('#facetSel'); filterState.facet='status:'+code; if(fs)fs.value='status:'+code; ensureCatalogVisible(); applyFilters(); closeRedlist(); toast('🔎',(RL[code]?RL[code].jp.split('（')[0]:code)+'でしぼりました',1900); }
function filterThreat(){ const fs=$('#facetSel'); filterState.facet='threat:1'; if(fs)fs.value='threat:1'; ensureCatalogVisible(); applyFilters(); closeRedlist(); toast('⚠','絶滅危惧（CR・EN・VU）でしぼりました',2000); }
window.closePanel=closePanel; window.showCountry=showCountry; window.selectAnimal=selectAnimal;
window.flyCountry=flyCountry; window.shareAnimal=shareAnimal; window.closeAbout=closeAbout;
window.openRedlist=openRedlist; window.closeRedlist=closeRedlist; window.filterStatus=filterStatus; window.filterThreat=filterThreat;

/* ---------- 地図ホバー（国＝代表5種の実写真／ズーム時＝この辺りの実観測＋地名）---------- */
const ZOOM_LOCAL_HOVER=6;   // この拡大率以上で「国」→「この辺り」のローカル表示に切替
function thumbHTML(photo,name,emoji){
  return `<span class="mt-th"><span class="mt-im">${photo?`<img src="${esc(photo)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${emoji||''}'">`:(emoji||'')}</span><b>${esc(name)}</b></span>`;
}
function countryHoverHTML(code,name){
  const here=ANIMALS.filter(a=>a.range.includes(code)).slice(0,5);   // 代表5種まで（図鑑掲載順）
  const thumbs=here.length
    ? `<div class="mt-thumbs">${here.map(a=>thumbHTML(a.photo,a.nameJa,a.emoji)).join('')}</div>`
    : `<div class="mt-sub">図鑑の代表種は未登録（クリックで実データを表示）</div>`;
  return `<div class="mt-name">${ccFlag(code)} ${esc(name)}</div>${thumbs}`;
}
// ⑤ ズーム時：カーソル付近の地名（OFMベクタータイルの地名ラベルをローカル取得＝ネットワーク不要）＋GBIF実観測の代表5種。
let _lhTimer=null, _lhKey=null; const _lhCache={};   // 種サムネ部分のみグリッドキャッシュ（地名は都度ローカル取得で最新）
function cancelLocalHover(){ clearTimeout(_lhTimer); _lhKey=null; }
// OFMの地名ラベル(place source-layer)から、カーソル付近の最も細かい地名を拾う（逆ジオコーディング不要）。
function getPlaceNameAt(point){
  if(typeof ofmLoaded==='undefined'||!ofmLoaded||!point) return '';
  let feats=[]; try{ feats=map.queryRenderedFeatures([[point.x-50,point.y-50],[point.x+50,point.y+50]]).filter(f=>f.sourceLayer==='place'); }catch(e){ return ''; }
  if(!feats.length) return '';
  const rank={neighbourhood:0,suburb:1,quarter:1,hamlet:2,village:3,town:4,island:4,city:5,county:6,state:7,province:7,region:7};
  feats.sort((a,b)=>(rank[a.properties.class]==null?9:rank[a.properties.class])-(rank[b.properties.class]==null?9:rank[b.properties.class]));
  const pr=feats[0].properties; return pr['name:ja']||pr.name||pr['name:latin']||'';
}
function localHover(lngLat, point){
  const lat=lngLat.lat, lng=lngLat.lng, gk=(Math.round(lat*20)/20)+','+(Math.round(lng*20)/20);   // ~5kmグリッド
  const tip=$('#maptip'), place=getPlaceNameAt(point)||'この辺り';
  _lhKey=gk;
  if(_lhCache[gk]){ tip.innerHTML=`<div class="mt-name">📍 ${esc(place)}</div>`+_lhCache[gk]; tip.classList.add('show'); refillHoverPhotos(tip,gk); return; }
  tip.innerHTML=`<div class="mt-name">📍 ${esc(place)}</div><div class="mt-sub">この辺りの生き物を確認中…</div>`; tip.classList.add('show');
  clearTimeout(_lhTimer); _lhTimer=setTimeout(()=>fetchLocalHover(lat,lng,gk,place),420);
}
async function fetchLocalHover(lat,lng,gk,place){
  const tip=$('#maptip'), y2=new Date().getFullYear(), y1=y2-10;
  let sp=[];
  try{ // クラス別に取得→各クラス上位をマージ（ホバーでも鳥だらけにしない）
    const per=await Promise.all(GBIF_VERT_GROUPS.map(g=> gbifFacetNear(lat,lng,8,g.keys,6,y1,y2).then(rows=>rows.slice(0,g.c==='Aves'?1:2))));
    const seen=new Map(); per.flat().forEach(c=>{ const key=c.name.toLowerCase(),cur=seen.get(key); if(!cur||cur.count<c.count) seen.set(key,c); });
    sp=[...seen.values()].sort((a,b)=>b.count-a.count).slice(0,5);
  }catch(e){}
  const thumbs = sp.length
    ? `<div class="mt-thumbs">${sp.map(c=>{const cat=ANIMALS.find(a=>(a.nameSci||'').split(' ').slice(0,2).join(' ').toLowerCase()===c.name.toLowerCase());
        return `<span class="mt-th" data-sci="${esc(c.name)}"><span class="mt-im">${cat?`<img src="${esc(cat.photo)}" alt="">`:''}</span><b>${esc(cat?cat.nameJa:c.name)}</b></span>`;}).join('')}</div>`
    : '<div class="mt-sub">この辺りのGBIF実観測は見つかりませんでした</div>';
  _lhCache[gk]=thumbs;
  if(_lhKey===gk){ tip.innerHTML=`<div class="mt-name">📍 ${esc(place||'この辺り')}</div>`+thumbs; tip.classList.add('show'); refillHoverPhotos(tip,gk); }
}
// 図鑑外の種は iNat 写真を後追い（このtipが同じグリッドを指す間だけ）。絵文字は使わず、未取得は空サムネ。
function refillHoverPhotos(tip,gk){
  tip.querySelectorAll('.mt-th[data-sci]').forEach(thmb=>{ const im=thmb.querySelector('.mt-im'); if(!im||im.querySelector('img'))return;   // 図鑑種は写真済み→スキップ
    const sci=thmb.getAttribute('data-sci');
    inatEnqueue(async()=>{ const v=await inatResolve(sci); if(_lhKey!==gk)return;
      const im2=thmb.querySelector('.mt-im'); if(im2&&!im2.querySelector('img')&&v&&v.ph) im2.innerHTML=`<img src="${esc(v.ph)}" alt="">`;
      const b=thmb.querySelector('b'); if(b&&v&&v.ja) b.textContent=v.ja; });   // 和名も補完
  });
}

/* ---------- 地図インタラクション ---------- */
function bindMap(){
  const tip=$('#maptip');
  // 地図クリック＝その地点のローカルへ（近くの生き物ツール）。遠いほど広い半径で着地＝いい感じのスケールに寄る。
  //   世界(z<3.5)→100km / 国(z<5.5)→50km / 近い→現在の半径 or 30km。近くの生き物＋実地図(OFM)を表示。
  map.on('click',(e)=>{
    if(nearPick){ setNearPin(e.lngLat.lat,e.lngLat.lng,'指定地点',nearState?nearState.radius:NEAR_DEFAULT_R); return; }
    const z=map.getZoom();
    const r = z<3.5 ? 100 : z<5.5 ? 50 : (nearState&&nearState.radius) ? nearState.radius : 30;
    tip.classList.remove('show');
    setNearPin(e.lngLat.lat, e.lngLat.lng, 'この地点', r);
  });
  // ホバー：★負荷対策＝「国が変わった時だけ」処理する（毎ピクセルの再描画/HTML再生成を排除＝重さの主因を除去）。
  //   表示は世界地図レベル（ズームが遠い）だけ＝国名＋代表種。ズームイン時はホバー表示しない（GBIF fetch等の重い経路も廃止）。
  let hoverCode=null;
  map.on('mousemove','c-fill',(e)=>{
    map.getCanvas().style.cursor='pointer';
    const code=e.features[0].properties[CODE_PROP];
    if(code===hoverCode) return;
    hoverCode=code;
    map.setFilter('c-hover',['==',['get',CODE_PROP],code]);
    if(map.getZoom() < ZOOM_LOCAL_HOVER){
      const f=e.features[0], name=f.properties.NAME_JA||(CC[code]?CC[code][0]:null)||f.properties.NAME||f.properties.ADMIN||code;
      tip.innerHTML=countryHoverHTML(code,name); tip.classList.add('show');
    } else tip.classList.remove('show');
  });
  map.on('mousemove',(e)=>{ if(!tip.classList.contains('show'))return; tip.style.left=(e.originalEvent.clientX+14)+'px'; tip.style.top=(e.originalEvent.clientY+14)+'px'; });
  map.on('mouseleave','c-fill',()=>{ hoverCode=null; map.setFilter('c-hover',['==',['get',CODE_PROP],'__none__']); map.getCanvas().style.cursor=''; tip.classList.remove('show'); });
}
// └───────────────────────────────────────── /ui.js ─────────────────────────────────────────┘

// ┌───────────────────────────────────────── nearby.js ─────────────────────────────────────────┐
/* ---------- 近くの生き物（脊椎動物・Chordata=taxonKey44） ----------
   現在地→GBIF geoDistance facet で周辺の種一覧→iNatで和名/写真を遅延付与。
   プライバシー：座標は~1km丸めしGBIF/iNatの問い合わせにのみ使用（保存はローカルのみ）。 */
const NEAR_RADII=[1,5,10,50,100,500,1000];                       // 半径(km)の選択肢（3/30/300は間引き）
const ZOOM_BY_R={1:13.2,3:11.9,5:11,10:10,30:8.4,50:7.6,100:6.6,300:5.2,500:4.5,1000:3.6};  // 半径→ズーム（円が収まる程度・全半径分を保持）
const NEAR_DEFAULT_R=10;
const NEAR_PRESETS=[['東京',35.68,139.76],['大阪',34.69,135.50],['札幌',43.06,141.35],['那覇',26.21,127.68],['ニューヨーク',40.71,-74.01],['ロンドン',51.51,-0.13],['シンガポール',1.35,103.82],['シドニー',-33.87,151.21],['ナイロビ',-1.29,36.82],['リオデジャネイロ',-22.91,-43.17]];
const NEAR_ICONIC={Aves:'鳥類',Mammalia:'哺乳類',Reptilia:'爬虫類',Amphibia:'両生類',Actinopterygii:'魚類',Chondrichthyes:'魚類（軟骨魚）',Teleostei:'魚類',Elasmobranchii:'魚類（軟骨魚）',Insecta:'昆虫',Arachnida:'クモ類'};
// 🦋虫は既定OFF（「すべて」に含めない＝苦手な人に配慮）。明示的に🦋虫チップを選んだ時だけ昆虫を出す。
const NEAR_CLASSES=[['','すべて'],['Aves','🐦鳥'],['Mammalia','🦫哺乳'],['Reptilia','🦎爬虫'],['Amphibia','🐸両生'],['Fish','🐟魚'],['Insecta','🦋虫']];
const LS_NEAR='biosphere_near_', LS_INAT='biosphere_inat_', LS_SKEY='biosphere_skey_', LS_IUCN='biosphere_iucn_', LS_CRT='biosphere_crt_';
const THREAT_CATS=new Set(['VU','EN','CR']);   // 絶滅危惧（Threatened）
// 地図に「ふわっと」出す生き物マーカー（ポケGO風）。GBIF実観測点に種マーカーを配置し、観測点へ広く散らす。
// ① 表示数はユーザー可変（アイコン／一覧 共通の上限）。旧・半径連動値は参考として残す。
const CREATURE_CAP_BY_R={1:12,3:14,5:16,10:18,30:22,50:26,100:30,300:34,500:38,1000:40};   // 参考（旧デフォルト）
const NEARCAP_MIN=8, NEARCAP_MAX=44, NEARCAP_DEF=24;
let nearCap=Math.max(NEARCAP_MIN,Math.min(NEARCAP_MAX,+(localStorage.getItem('biosphere_nearcap'))||NEARCAP_DEF));   // 近くモードの表示数（アイコン＋一覧・8〜44・localStorage保存）
function creatureCap(r){ return nearCap; }   // ★表示数コントロールで可変（半径連動から変更）
const CREATURE_POOL=48;  // ③ 候補プール上限（表示上限44より多め＝再訪ごとに重み付きランダムで別の顔ぶれ）
// ② 広く散らす：farthest-point sampling。候補点のうち既存マーカーから最も遠い点を返す（円内をまんべんなく埋める）。
function distSq(a,b){ const dx=a[0]-b[0], dy=a[1]-b[1]; return dx*dx+dy*dy; }
function spreadPoint(pts, placed){ if(!pts||!pts.length) return null; if(!placed||!placed.length) return pts[0];
  let best=pts[0], bestMin=-1; for(const p of pts){ let m=Infinity; for(const q of placed){ const d=distSq(p,q); if(d<m){ m=d; if(m<=bestMin) break; } } if(m>bestMin){ bestMin=m; best=p; } } return best; }
// 1種の観測点群を「重心付近＋広がる数点」に間引く（散らし用の候補＝キャッシュも小さく保つ）。
function thinPoints(list){ if(!list||!list.length) return []; if(list.length<=5) return list.slice();
  const out=[medoid(list)]; while(out.length<5){ const p=spreadPoint(list,out); if(!p||out.some(q=>q[0]===p[0]&&q[1]===p[1])) break; out.push(p); } return out; }
// 昆虫の写真差し替え前プレースホルダは 🦋（芋虫🐛でなくちょうちょ＝親しみやすさ優先）。
const CLASS_EMOJI={Aves:'🐦',Mammalia:'🐾',Reptilia:'🦎',Amphibia:'🐸',Actinopterygii:'🐟',Chondrichthyes:'🦈',Fish:'🐟',Teleostei:'🐟',Elasmobranchii:'🦈',Insecta:'🦋',Arachnida:'🕷️',Mollusca:'🐚'};
function classEmoji(cls){ return CLASS_EMOJI[cls]||'🐾'; }
// ② 近くの生き物名を図鑑の和名に統一：学名(二名)が図鑑にあればその和名を優先（iNat和名との食い違いを解消）。未収録種はnull。
let _sci2an=null;
function animalBySci(sci){ if(!ANIMALS||!ANIMALS.length) return null;
  if(!_sci2an){ _sci2an=new Map(); for(const a of ANIMALS){ _sci2an.set((a.nameSci||'').split(' ').slice(0,2).join(' ').toLowerCase(), a); } }
  return _sci2an.get(String(sci||'').split(' ').slice(0,2).join(' ').toLowerCase())||null; }
// 鳴き声（発声）する分類だけに鳴き声ボタンを出す。植物・魚・爬虫・貝などは iNat の「音」が環境音/誤り
// になりやすいので抑制。iNat iconic名(Aves…)と図鑑の和名クラス(鳥類…)の両方を受ける。空(不明)は許容＝過剰抑制回避。
const VOCAL_CLASSES=new Set(['Aves','Mammalia','Amphibia','Insecta','鳥類','哺乳類','両生類','昆虫']);
function vocalizes(k){ return !k || VOCAL_CLASSES.has(k); }
// ★GBIF occurrence は eBird 由来で鳥に極端に偏る（同一地点で鳥が哺乳の約300倍）。単一 taxonKey=44 の
// 観測数順だと上位がほぼ全部鳥になる（＝報告バグ）。クラス別に facet 取得してマージし各クラスのご当地上位を必ず出す。
// キーは実occurrenceで動作確認済（新backbone）：鳥212・哺乳359・両生131・爬虫=Squamata11592253+Testudines11418114・
// 魚=Actinopterygii204+Elasmobranchii121。※条鰭魚(204)はGBIFがclassKey未付与の地点が多く実質軟骨魚中心になる場合あり。
const GBIF_VERT_GROUPS=[
  {c:'Aves',     keys:[212],               cap:12},
  {c:'Mammalia', keys:[359],               cap:12},
  {c:'Reptilia', keys:[11592253,11418114], cap:12},
  {c:'Amphibia', keys:[131],               cap:12},
  {c:'Fish',     keys:[204,121],           cap:12},
];
const NEAR_CLASS_KEYS={Aves:[212],Mammalia:[359],Reptilia:[11592253,11418114],Amphibia:[131],Fish:[204,121],Insecta:[216]};
// 近くマーカー/一覧の取得グループ。種別を1つ以上選ぶとその選択クラスだけ（🦋虫も明示選択で有効・複数選択可）／未選択＝「すべて」は脊椎動物のみ。
function nearGroups(){
  if(!nearClasses.length) return GBIF_VERT_GROUPS;
  const cap = nearClasses.length===1 ? 45 : Math.max(12, Math.ceil(45/nearClasses.length));   // 一覧の1グループあたり取得上限（合算後に45で切る）
  return nearClasses.filter(c=>NEAR_CLASS_KEYS[c]).map(c=>({c, keys:NEAR_CLASS_KEYS[c], cap}));
}
// 選択中クラスのキャッシュキー（順不同で安定）／表示ラベル（絵文字付きを「・」連結）
function nearClsKey(){ return nearClasses.length ? nearClasses.slice().sort().join('+') : 'all'; }
function nearClassLabel(){ return nearClasses.map(c=>(NEAR_CLASSES.find(x=>x[0]===c)||['',''])[1]).join('・'); }
// クラス別 facet 取得（429リトライ）。scientificName を二名へ正規化して返す。
async function gbifFacetNear(lat,lng,radius,keys,facetLimit,y1,y2,human){
  const kp=keys.map(x=>'&taxonKey='+x).join('');
  const basis=gbifBasisQ(human===false);   // 魚は人観測に乏しいので標本/機械観測も拾う（化石・動物園は除外）
  const url=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km${kp}&hasCoordinate=true${basis}&year=${y1},${y2}&limit=0&facet=scientificName&facetLimit=${facetLimit}`;
  for(let i=0;i<3;i++){ try{ const r=await fetch(url); if(r.status===429){ await new Promise(s=>setTimeout(s,1200*(i+1))); continue; }
    if(!r.ok) return []; const d=await r.json(); return mergeBinomials((d.facets&&d.facets[0]&&d.facets[0].counts)||[]);
  }catch(e){ await new Promise(s=>setTimeout(s,600)); } }
  return [];
}
// クラス別 occurrence 取得（座標付き＝マーカー用）
async function gbifOccByGroup(lat,lng,radius,keys,limit,y1,y2,human){
  const kp=keys.map(x=>'&taxonKey='+x).join('');
  const basis=gbifBasisQ(human===false);   // 魚だけ標本/機械観測も拾う（化石・動物園は除外）
  const url=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km${kp}&hasCoordinate=true${basis}&year=${y1},${y2}&limit=${limit}`;
  for(let i=0;i<3;i++){ try{ const r=await fetch(url); if(r.status===429){ await new Promise(s=>setTimeout(s,1000*(i+1))); continue; }
    if(!r.ok){ await new Promise(s=>setTimeout(s,400)); continue; } const d=await r.json(); return d.results||[];
  }catch(e){ await new Promise(s=>setTimeout(s,500)); } }
  return [];
}
// ① 海洋データは OBIS（海の生物地理情報システム）を併用＝GBIFの人観測が乏しい外洋/海でも魚が出る。
//   taxonid=硬骨魚(10194)+サメ類(10193)+クジラ類(2688)に絞りプランクトン/微生物を除外。radius→矩形bboxで問い合わせる。
const OBIS_TAXA='10194,10193,2688';
function obisBbox(lat,lng,radius){ const dLat=radius/111, dLng=radius/(111*Math.max(0.18,Math.cos(lat*Math.PI/180)));
  const x0=(lng-dLng).toFixed(4), x1=(lng+dLng).toFixed(4), y0=Math.max(-89.9,lat-dLat).toFixed(4), y1=Math.min(89.9,lat+dLat).toFixed(4);
  return `POLYGON((${x0} ${y0},${x1} ${y0},${x1} ${y1},${x0} ${y1},${x0} ${y0}))`; }
const OBIS_SKIP_BASIS=/fossil|living/i;   // OBISはDarwin Core表記（FossilSpecimen/LivingSpecimen）。GBIF側と同じく化石・飼育個体は「近くの生き物」に出さない
async function obisOcc(lat,lng,radius,limit){   // 座標付き occurrence（マーカー用・GBIFと同形で返す）
  const url=`https://api.obis.org/v3/occurrence?geometry=${encodeURIComponent(obisBbox(lat,lng,radius))}&taxonid=${OBIS_TAXA}&size=${limit}`;
  for(let i=0;i<3;i++){ try{ const r=await fetch(url); if(r.status===429){ await new Promise(s=>setTimeout(s,1000*(i+1))); continue; }
    if(!r.ok){ await new Promise(s=>setTimeout(s,400)); continue; } const d=await r.json();
    return (d.results||[]).filter(o=>o.decimalLatitude!=null&&o.decimalLongitude!=null&&!OBIS_SKIP_BASIS.test(o.basisOfRecord||'')).map(o=>({
      species:o.species||'', scientificName:o.scientificName||o.species||'', class:o.class||'Actinopterygii',
      decimalLatitude:o.decimalLatitude, decimalLongitude:o.decimalLongitude }));
  }catch(e){ await new Promise(s=>setTimeout(s,500)); } }
  return [];
}
// 種＋記録数（一覧用・[{name,count,ocls}]）。OBIS_TAXA はクジラ類(2688)も含むので魚グループに併合しても
// 「魚とは限らない」。実クラス(ocls)を持ち帰り、basisの広げ方(wide)だけはクジラを魚扱いしないようにする。
async function obisChecklist(lat,lng,radius){
  const url=`https://api.obis.org/v3/checklist?geometry=${encodeURIComponent(obisBbox(lat,lng,radius))}&taxonid=${OBIS_TAXA}`;
  for(let i=0;i<3;i++){ try{ const r=await fetch(url); if(r.status===429){ await new Promise(s=>setTimeout(s,1000*(i+1))); continue; }
    if(!r.ok){ await new Promise(s=>setTimeout(s,400)); continue; } const d=await r.json();
    return (d.results||[]).filter(o=>o.taxonRank==='Species'&&o.scientificName).map(o=>({name:o.scientificName,count:o.records||0,ocls:o.class||''}));
  }catch(e){ await new Promise(s=>setTimeout(s,500)); } }
  return [];
}
function mergeCounts(...lists){ const m=new Map();   // 複数の[{name,count,ocls?}]を二名キーで統合（最大値・降順）
  for(const l of lists) for(const r of (l||[])){ const k=(r.name||'').toLowerCase(); if(!k) continue; const e=m.get(k);
    if(e){ e.count=Math.max(e.count,r.count); if(!e.ocls&&r.ocls) e.ocls=r.ocls; } else m.set(k,{name:r.name,count:r.count,ocls:r.ocls||''}); }
  return [...m.values()].sort((a,b)=>b.count-a.count);
}
let nearState=null;                 // {lat,lng,radius,label}
let nearMarker=null, nearPick=false, nearTimer=null, nearClasses=[], nearThreatOnly=false, nearRows=[], nearPtsOn=false, nearSort='count';
// ⑤ 一覧の並び替え（既定＝記録の多い順＝その範囲の生息数のめやす）。名前/分類/絶滅危機に切替可。
const NEAR_CLS_ORDER=['Mammalia','Aves','Reptilia','Amphibia','Fish','Teleostei','Elasmobranchii','Actinopterygii','Chondrichthyes','Insecta'];
function nearClsRank(c){ const i=NEAR_CLS_ORDER.indexOf(c.gcls||c.ic||''); return i<0?99:i; }
function nearThRank(st){ return {CR:3,EN:2,VU:1}[st]||0; }
function nearSortRows(){
  if(nearSort==='name') nearRows.sort((a,b)=>String(a.ja||a.name).localeCompare(String(b.ja||b.name),'ja'));
  else if(nearSort==='cls') nearRows.sort((a,b)=>(nearClsRank(a)-nearClsRank(b))||(b.count-a.count));
  else if(nearSort==='threat') nearRows.sort((a,b)=>(nearThRank(b.st2)-nearThRank(a.st2))||(b.count-a.count));
  else nearRows.sort((a,b)=>b.count-a.count);   // count＝記録の多い順（既定）
}
function setNearSort(v){ nearSort=v; if(v!=='count') resolveRemainingRows(); renderNearList(); }   // 名前/分類/絶滅危機は解決データが要る＝残りも解決
// 表示数（アイコン＋一覧の上限）をユーザーが変更。localStorage保存＋一覧/マーカーを取り直し。
function setNearCap(n){ n=Math.max(NEARCAP_MIN,Math.min(NEARCAP_MAX,Math.round(+n)||NEARCAP_DEF));
  if(n===nearCap){ return; } nearCap=n; try{ localStorage.setItem('biosphere_nearcap',n); }catch(e){}
  if(nearState){ queryNear(); loadNearCreatures(nearState.lat,nearState.lng,nearState.radius,true); } else renderNearList&&nearRows&&renderNearList(); }
// スライダードラッグ中の即時ラベル更新（refetchはonchangeのsetNearCapで）。
function capLive(n){ const el=document.querySelector('.capnum b'); if(el) el.textContent=Math.round(+n); }
let creatureMarkers=[], creatureTimer=null, creaturesKey=null, threatToastShown=false, creatureGen=0, queryGen=0;   // Gen=単調増加の世代トークン（同一丸め座標への素早い出戻りA→B→Aでも古いin-flightバッチを確実に破棄）
function nearKey(lat,lng,r){ return lat.toFixed(2)+','+lng.toFixed(2)+'@'+r; }
// iNat学名キャッシュ（30日）／近傍ファセットキャッシュ（1日）
function inatGet(s){ try{const o=JSON.parse(localStorage.getItem(LS_INAT+s)||'null'); if(o&&(Date.now()-o.t)<2592e6)return o.v;}catch(e){} return null; }
function inatSet(s,v){ try{localStorage.setItem(LS_INAT+s,JSON.stringify({t:Date.now(),v}));}catch(e){} }
function nearCacheGet(k){ try{const o=JSON.parse(localStorage.getItem(LS_NEAR+k)||'null'); if(o&&(Date.now()-o.t)<864e5)return o.c;}catch(e){} return null; }
function nearCacheSet(k,c){ try{localStorage.setItem(LS_NEAR+k,JSON.stringify({t:Date.now(),c}));}catch(e){} }
// ⑤ 生き物マーカーの地点キャッシュ（1日）＝直近に見た地点は往復ゼロで即マーカー化。pick={sci,c:[lon,lat],cls,n}。
function creatureCacheGet(k){ try{const o=JSON.parse(localStorage.getItem(LS_CRT+k)||'null'); if(o&&(Date.now()-o.t)<864e5&&Array.isArray(o.c))return o.c;}catch(e){} return null; }
function creatureCacheSet(k,c){ try{localStorage.setItem(LS_CRT+k,JSON.stringify({t:Date.now(),c}));}catch(e){} }
// iNat呼び出しはthrottle（同時3・間隔120ms）で礼儀正しく
let inatQueue=[], inatBusy=0;
function inatEnqueue(fn){ inatQueue.push(fn); pumpInat(); }
function pumpInat(){ while(inatBusy<3 && inatQueue.length){ const fn=inatQueue.shift(); inatBusy++; Promise.resolve(fn()).catch(()=>{}).finally(()=>{ inatBusy--; setTimeout(pumpInat,120); }); } }
// 同一種の同時解決を1本にまとめる（一覧と生き物マーカーで同じ種を二重取得しない＝リクエスト数を削減）。
const _inflight={};
function dedupe(key,fn){ if(_inflight[key]) return _inflight[key];
  const p=Promise.resolve().then(fn).finally(()=>{ delete _inflight[key]; }); _inflight[key]=p; return p; }
async function inatResolve(sci){
  const c=inatGet(sci); if(c) return c;
  return dedupe('inat:'+sci, async()=>{
    const c0=inatGet(sci); if(c0) return c0;
    const low=String(sci).toLowerCase(), bin=low.split(/\s+/).slice(0,2).join(' ');   // bin=二名（三名/亜種はiNatの種ランク二名に一致させる）
    for(let i=0;i<3;i++){
      try{
        const r=await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sci)}&rank=species&per_page=5&locale=ja`);
        if(r.status===429){ await new Promise(s=>setTimeout(s,1500*(i+1))); continue; }
        const d=await r.json(), arr=(d.results||[]);
        const nm=t=>(t.name||'').toLowerCase();
        const exactHit=arr.find(t=>nm(t)===low || nm(t)===bin);   // 学名一致(二名/三名どちらでも)を優先＝別種の写真/和名/鳴き声を掴まない
        const x=exactHit||arr[0], dp=x&&x.default_photo;
        const at=(dp&&dp.attribution||'').replace(/<[^>]*>/g,'').replace(/\(c\)/gi,'©');
        const exact=!!(x&&(nm(x)===low||nm(x)===bin));   // 完全一致(二名正規化含む)＝鳴き声を出してよいかの判定に使う
        const v=x?{ja:x.preferred_common_name||'',ph:(dp&&dp.square_url)||'',ic:x.iconic_taxon_name||'',st:(x.conservation_status&&x.conservation_status.status_name)||'',at,id:x.id||0,exact}:{ja:'',ph:'',ic:'',st:'',at:'',id:0,exact:false};
        inatSet(sci,v); return v;
      }catch(e){ await new Promise(s=>setTimeout(s,600)); }
    }
    return {ja:'',ph:'',ic:'',st:'',at:'',id:0,exact:false};
  });
}
// GBIF種キー解決（species/match、localStorageキャッシュ）＝月別/観測点に使用
async function resolveSpeciesKey(sci){
  try{ const c=localStorage.getItem(LS_SKEY+sci); if(c)return c==='0'?null:+c; }catch(e){}
  return dedupe('skey:'+sci, async()=>{
    try{ const c=localStorage.getItem(LS_SKEY+sci); if(c)return c==='0'?null:+c; }catch(e){}
    try{ const r=await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sci)}`);
      if(!r.ok) return null;                       // 429/5xx等の一過性失敗はキャッシュせず再訪で再試行（毒化防止）
      const j=await r.json(); const k=j.usageKey||j.speciesKey||0;
      try{localStorage.setItem(LS_SKEY+sci,String(k||0));}catch(e){}   // HTTP200のみ恒久キャッシュ（真の未マッチ matchType:NONE は k=0='0'＝正しい）
      return k||null;
    }catch(e){ return null; }
  });
}
// 保全状況（IUCNカテゴリ）を GBIF から直接取得（IUCN APIの商用制約を回避）。RARITYコードへ写像しキャッシュ。
const STMAP_I={LEAST_CONCERN:'LC',NEAR_THREATENED:'NT',VULNERABLE:'VU',ENDANGERED:'EN',CRITICALLY_ENDANGERED:'CR',DATA_DEFICIENT:'DD',NOT_EVALUATED:'NE',EXTINCT_IN_THE_WILD:'EW',EXTINCT:'EX'};
function iucnGet(s){ try{const v=localStorage.getItem(LS_IUCN+s); return v===null?undefined:v;}catch(e){return undefined;} }
function iucnSet(s,v){ try{localStorage.setItem(LS_IUCN+s,v);}catch(e){} }
async function resolveIucn(sci){
  const c=iucnGet(sci); if(c!==undefined) return c;
  return dedupe('iucn:'+sci, async()=>{
    const c0=iucnGet(sci); if(c0!==undefined) return c0;
    const key=await resolveSpeciesKey(sci); if(!key) return '';   // キー無し（真の未マッチ/一過性失敗）はIUCNをキャッシュしない（種キャッシュ側で再試行制御）
    try{ const r=await fetch(`https://api.gbif.org/v1/species/${key}/iucnRedListCategory`);
      if(r.ok){ const j=await r.json(); const code=STMAP_I[j.category]||''; iucnSet(sci,code); return code; }   // 取得成功のみ恒久キャッシュ
      if(r.status===404){ iucnSet(sci,''); return ''; } }catch(e){}   // 評価対象外＝確定的に無し（キャッシュ）
    return '';   // 429/5xx/例外＝一過性なのでキャッシュせず一時値で返す（再訪で再試行＝毒化防止）
  });
}
// GBIF scientificName facet を二名に正規化＆統合（種に限定）
function mergeBinomials(counts){
  const m=new Map();
  for(const c of counts){ const p=(c.name||'').trim().split(/\s+/);
    if(p.length<2||!/^[A-Z][a-zé-]+$/.test(p[0])||!/^[a-zé-]+$/.test(p[1])) continue;
    const key=p[0]+' '+p[1]; m.set(key,(m.get(key)||0)+c.count); }
  return [...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
}
function renderNearShell(title,inner){
  panelSheet(true);   // 近くの一覧/詳細はモバイルで中間高さ＝上に地図＋生き物を見せる
  panelEl.innerHTML=`<button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button><div class="grab"></div>
    <div class="cc-head"><div class="lbl">📍 あなたの近く</div><div class="cname">${esc(title)}</div></div>
    <div class="nearbody">${inner}</div>`;
}
function openNearby(){
  closePanel(); stopSpin();
  if(!('geolocation' in navigator)){ nearbyFallback('お使いの環境では現在地を取得できません。'); return; }
  renderNearShell('近くの生き物','<div class="nearsum">現在地を確認しています…<br><span style="color:#9fb0bd">ブラウザの確認ダイアログで「許可」を選んでください。</span></div>'); openPanel();
  navigator.geolocation.getCurrentPosition(
    pos=>setNearPin(pos.coords.latitude,pos.coords.longitude,'現在地',NEAR_DEFAULT_R),
    err=>nearbyFallback(err&&err.code===1?'位置情報の利用が許可されませんでした。':'現在地を取得できませんでした。'),
    {enableHighAccuracy:false,timeout:8000,maximumAge:300000});
}
function nearbyFallback(msg){
  const chips=NEAR_PRESETS.map(([n,la,lo])=>`<button class="nbchip" onclick="setNearPin(${la},${lo},'${n}',NEAR_DEFAULT_R)">${n}</button>`).join('');
  renderNearShell('近くの生き物',
    `<div class="nearsum">${msg}</div>
     <div class="nbhint">場所を選ぶ、または<b>地図をタップ</b>して指定してください。</div>
     <div class="nbchips">${chips}</div>
     <div class="nbhint" style="margin-top:11px">世界全体を旅したいときは：<button class="nbchip" onclick="resetAll()">🌐 世界地図（地球儀）を見る</button></div>`);
  openPanel(); nearPick=true; toast('📍','地図をタップして場所を指定できます',2600);
}
// 任意地点に「ピン」を置く（現在地/都市/タップ/ドラッグ 共通の入口）
function setNearPin(latRaw,lngRaw,label,radius){
  const lat=Math.round(latRaw*100)/100, lng=Math.round(lngRaw*100)/100;   // ~1km丸め（プライバシー）
  nearPick=false; currentAnimal=null; removeWorldCreatures();   // 近くへ入るとき世界の浮遊アイコンは撤去
  nearState={lat,lng,radius:radius||(nearState&&nearState.radius)||NEAR_DEFAULT_R,label:label||'指定地点'};
  currentMode={type:'near',lat,lng};
  setMode('📍 '+nearState.label+'の近くの生き物'); showYearbar(false);
  removeNearPoints(); nearClasses=[]; nearThreatOnly=false;
  setLocalBasemap(true); localMapAutoOn=true;   // 近く＝本物の地図（OpenFreeMap）を自動ON（離脱時に自動分だけ戻す）
  drawNearVisuals(lat,lng,nearState.radius);
  stopSpin(); map.flyTo({center:[lng,lat],zoom:ZOOM_BY_R[nearState.radius]||9,speed:.9,curve:1.4,essential:true});
  queryNear(true);   // ★地点確定（現在地/都市/タップ/ドラッグ終了）は単発操作＝デバウンス0で即取得（初アイコンを速く）
  loadNearCreatures(lat,lng,nearState.radius,true);   // 地図に生き物がふわっと出現（初回=即）
  saveLastLoc(lat,lng,nearState.radius);   // 次回起動のフォールバック（前回の場所）に記録
}
function setNearRadius(r){ if(!nearState)return; nearState.radius=r; removeNearPoints();
  drawNearVisuals(nearState.lat,nearState.lng,r);
  map.flyTo({center:[nearState.lng,nearState.lat],zoom:ZOOM_BY_R[r]||9,speed:.8,curve:1.3,essential:true});
  queryNear(); loadNearCreatures(nearState.lat,nearState.lng,r);
  saveLastLoc(nearState.lat,nearState.lng,r); }
// 種別チップのトグル。「すべて」(c='')＝選択解除／個別クラスは押すたびON/OFF（複数選択可＝鳥+虫など）。最後の1つを外すと「すべて」に戻る。
function setNearClass(c){
  if(!c){ nearClasses=[]; }
  else { const i=nearClasses.indexOf(c); if(i>=0) nearClasses.splice(i,1); else nearClasses.push(c); }
  if(nearState){ queryNear(); loadNearCreatures(nearState.lat,nearState.lng,nearState.radius,true); }   // 一覧＋マーカーの両方を選択クラスで絞り再取得
}
function armNearPick(){ nearPick=true; toast('📌','地図をタップすると、その地点に移動します',2400); }
function recenterCurrent(){
  if(!('geolocation' in navigator)){ toast('📍','現在地を取得できません',2000); return; }
  toast('📍','現在地を確認しています…',1800);
  navigator.geolocation.getCurrentPosition(
    pos=>setNearPin(pos.coords.latitude,pos.coords.longitude,'現在地',nearState?nearState.radius:NEAR_DEFAULT_R),
    ()=>toast('📍','現在地を取得できませんでした',2200),{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
}
// GBIFファセットで近傍の種一覧を取得→nearRowsへ（クラス別バランス取得＝鳥偏重を打破）
// 未選択＝脊椎5クラスを段階描画／種別を選ぶと選択クラス群（1つでも複数でも）を同じ段階描画ロジックで取得。
function queryNear(immediate){
  const {lat,lng,radius}=nearState, clsKey=nearClsKey(), k=nearKey(lat,lng,radius)+'|'+clsKey, cached=nearCacheGet(k), gen=++queryGen;
  if(cached&&cached.length){ nearRows=cached.map(c=>({name:c.name,count:c.count,gcls:c.gcls,ocls:c.ocls||''})); renderNearList(); }
  else { nearRows=[]; renderNearList('<div class="nearsum">🛰️ 周辺の記録を集めています…</div>'); }
  clearTimeout(nearTimer);
  const run=()=>{
    const y2=new Date().getFullYear(), y1=y2-10;
    const groups=nearGroups();          // 未選択＝脊椎5クラス／選択時＝そのクラス群（複数可）
    const single=groups.length===1;     // 1クラスだけなら厚めに取得（facet 45）
    const stale=()=> gen!==queryGen||!currentMode||currentMode.type!=='near'||(nearKey(currentMode.lat,currentMode.lng,nearState.radius)+'|'+clsKey)!==k;
    const noneMsg=()=>{ const lab=nearClasses.length?nearClassLabel():'脊椎動物'; nearRows=[]; renderNearList('<div class="nearsum">この範囲の'+esc(lab)+'の記録は見つかりませんでした。半径を広げるか場所を変えてみてください。</div>'); };
    // ★段階描画：クラス別 facet を Promise.all で束ねず、最初に返ったクラスで一覧を即描画→出そろい時に確定。
    //   行は name キーでオブジェクトを使い回すので、再描画で iNat解決済み(和名/写真/保全)を失わない。
    const groupRows=new Array(groups.length).fill(null), rowObj=new Map();
    let firstPainted=!!(cached&&cached.length), settled=0;   // キャッシュ表示済みなら中間描画を省いてチラつき回避
    const rebuild=()=>{   // 現在返っているクラスをラウンドロビンでインターリーブ（先頭からクラスが交互＝1クラスに偏って見えない）
      const merged=[], seen=new Set(), maxLen=Math.max(0,...groupRows.map(r=>r?r.length:0));
      for(let i=0;i<maxLen;i++) for(let gi=0;gi<groupRows.length;gi++){ const rr=groupRows[gi], c=rr&&rr[i]; if(!c) continue;
        const key=c.name.toLowerCase(); if(seen.has(key)) continue; seen.add(key);
        let obj=rowObj.get(key); if(!obj){ obj={name:c.name,count:c.count,gcls:c.gcls,ocls:c.ocls||''}; rowObj.set(key,obj); } else obj.count=Math.max(obj.count,c.count);
        merged.push(obj); }
      return merged.slice(0,nearCap);   // 一覧件数は表示数コントロール連動
    };
    groups.forEach((g,gi)=>{
      const isFish=g.c==='Fish';   // ① 魚グループは GBIF facet ＋ OBIS checklist を併合（外洋の魚も一覧に）
      const flim=single?45:18;     // 1クラス＝厚め／複数＝各クラス控えめ（合算後に45で切る）
      const fp=isFish
        ? Promise.all([gbifFacetNear(lat,lng,radius,g.keys,flim,y1,y2,false), obisChecklist(lat,lng,radius)]).then(([a,b])=>mergeCounts(a,b))
        : gbifFacetNear(lat,lng,radius,g.keys,flim,y1,y2,true);
      fp
        .then(rows=>{ if(stale()) return;
          groupRows[gi]=rows.slice(0,Math.max(g.cap,nearCap)).map(c=>({name:c.name,count:c.count,gcls:g.c,ocls:c.ocls||''}));   // 単一クラス時も表示数まで拾えるよう g.cap と nearCap の大きい方。ocls=OBIS由来の実クラス（クジラを魚扱いしない）
          if(!firstPainted){ const merged=rebuild(); if(merged.length){ nearRows=merged; renderNearList(); firstPainted=true; } }   // 最速クラスで一覧を即出す
        })
        .catch(()=>{})
        .finally(()=>{ settled++; if(settled!==groups.length || stale()) return;   // 全クラス出そろい＝確定描画＋キャッシュ
          const merged=rebuild();
          if(!merged.length){ noneMsg(); }
          else { nearCacheSet(k,merged.map(c=>({name:c.name,count:c.count,gcls:c.gcls,ocls:c.ocls||''}))); nearRows=merged; renderNearList(); }
        });
    });
  };
  if(immediate) run(); else nearTimer=setTimeout(run,250);   // ★初回(地点確定)は即・半径/種別の連打はデバウンス
}
/* ---- 住所・地名で移動（Nominatim forward geocoding）----
   パネルの再描画に巻き込まれないよう body直下のモーダルで実装。検索→候補一覧→タップで setNearPin。 */
let addrModal=null;
function openAddrSearch(prefill){
  if(!addrModal){
    addrModal=document.createElement('div'); addrModal.className='addrmodal'; addrModal.hidden=true;
    addrModal.innerHTML=`<div class="addrbg" onclick="closeAddrSearch()"></div>
      <div class="addrcard" role="dialog" aria-modal="true" aria-label="住所・地名で移動">
        <div class="addrhd"><b>🔍 住所・地名で移動</b><button class="addrx" onclick="closeAddrSearch()" aria-label="閉じる">✕</button></div>
        <form class="addrform" onsubmit="return searchNearAddr(event)">
          <input id="addrInput" type="search" placeholder="例：渋谷駅／京都市東山区／Yellowstone" autocomplete="off" aria-label="住所・地名で検索">
          <button type="submit" class="addrgo">検索</button>
        </form>
        <div class="addrresults" id="addrResults"></div>
        <div class="addrnote">世界の住所・地名・施設名で検索できます（データ：OpenStreetMap / Nominatim）。</div>
      </div>`;
    document.body.appendChild(addrModal);
    // Escape はこのモーダルだけ閉じる。stopPropagation しないと document のグローバルEscapeハンドラまで伝播し背後の近くパネルまで畳まれる。
    addrModal.addEventListener('keydown',e=>{ if(e.key==='Escape' && !addrModal.hidden){ e.stopPropagation(); closeAddrSearch(); } });
  }
  addrModal.hidden=false;
  const inp=addrModal.querySelector('#addrInput'); inp.value=(prefill||''); addrModal.querySelector('#addrResults').innerHTML='';
  setTimeout(()=>inp.focus(),30);
  if(prefill) searchNearAddr();   // 図鑑検索窓からの事前入力は即検索して候補を出す
}
function closeAddrSearch(){ if(addrModal) addrModal.hidden=true; }
async function searchNearAddr(ev){
  if(ev&&ev.preventDefault) ev.preventDefault();
  if(!addrModal) return false;
  const inp=addrModal.querySelector('#addrInput'), q=inp.value.trim(), box=addrModal.querySelector('#addrResults');
  if(!q){ inp.focus(); return false; }
  box.innerHTML='<div class="addrmsg">検索中…</div>';
  try{
    const url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&accept-language=ja&addressdetails=1`;
    const list=await (await fetch(url)).json();
    if(!Array.isArray(list)||!list.length){ box.innerHTML='<div class="addrmsg">見つかりませんでした。表記を変えて試してください。</div>'; return false; }
    box.innerHTML=list.map(it=>{
      const la=(+it.lat), lo=(+it.lon); if(!(la>=-90&&la<=90&&lo>=-180&&lo<=180)) return '';
      const full=esc(it.display_name||''), head=esc((it.display_name||'').split(',')[0]||'指定地点');
      return `<button class="addritem" data-lat="${la.toFixed(5)}" data-lon="${lo.toFixed(5)}" data-nm="${head}" onclick="pickAddr(this)">📍 <span>${full}</span></button>`;
    }).join('');
  }catch(e){ box.innerHTML='<div class="addrmsg">検索に失敗しました（オフライン？）。少し時間をおいて再度お試しください。</div>'; }
  return false;
}
function pickAddr(btn){
  const la=+btn.dataset.lat, lo=+btn.dataset.lon, nm=btn.dataset.nm||'指定地点';
  if(!(la>=-90&&la<=90&&lo>=-180&&lo<=180)) return;
  closeAddrSearch(); stopSpin();
  setNearPin(la,lo,nm,(nearState&&nearState.radius)||NEAR_DEFAULT_R);   // 検索地点を近くの中心に（半径は現状維持）
}
// 図鑑検索窓（#search / #dockSearch）からも住所・地名で地図移動できるようにする。
// 種の絞り込み（filterState.q）はそのまま。入力2文字以上で窓の直下に「📍 地図で探す」候補を出し、押すと住所検索モーダルへ引き継ぐ。
let _mapSug=null, _mapSugQ='';
function ensureMapSug(){
  if(_mapSug) return _mapSug;
  _mapSug=document.createElement('button');
  _mapSug.type='button'; _mapSug.className='mapsug'; _mapSug.hidden=true;
  _mapSug.addEventListener('mousedown',e=>e.preventDefault());   // 入力のblurより先に発火させない＝クリックを確実に拾う
  _mapSug.addEventListener('click',()=>{ const q=_mapSugQ; hideMapSug(); if(q) openAddrSearch(q); });   // 既存の住所検索モーダルを事前入力＋即検索で開く
  document.body.appendChild(_mapSug);
  // ページ本体のスクロール/リサイズで位置ズレするので閉じる。※capture無し＝scrollはバブルしないため地図内部スクロールでは発火しない（誤閉じ防止）。
  addEventListener('scroll',()=>hideMapSug());
  addEventListener('resize',()=>hideMapSug());
  return _mapSug;
}
function updateMapSug(input){
  const q=(input&&input.value||'').trim();
  if(q.length<2){ hideMapSug(); return; }
  const el=ensureMapSug(); _mapSugQ=q;
  el.innerHTML='<span class="msmain">📍 「'+esc(q)+'」を地図で探す</span><span class="ms2">住所・地名・施設</span>';
  const r=input.getBoundingClientRect();
  el.style.left=Math.round(r.left)+'px'; el.style.top=Math.round(r.bottom+4)+'px'; el.style.minWidth=Math.round(r.width)+'px';
  el.hidden=false;
}
function hideMapSug(){ if(_mapSug) _mapSug.hidden=true; }
// 図鑑検索窓に「地図で探す」候補を配線（種の絞り込みハンドラは既存のまま・これは追加配線）。
function wireMapSug(input){
  if(!input) return;
  input.addEventListener('input',()=>updateMapSug(input));
  input.addEventListener('blur',()=>setTimeout(hideMapSug,150));   // 候補クリックの猶予を残して閉じる
  input.addEventListener('keydown',e=>{ if(e.key==='Escape') hideMapSug(); });
}
let nearFiltersOpen=false;   // シンプル化⑤b：近くの細かい操作（半径/種別/並び/表示数）は既定で畳む。開閉状態は再描画をまたいで保持（docs/design/11-B）
function toggleNearFilters(btn){
  nearFiltersOpen=!nearFiltersOpen;
  const d=document.getElementById('nearfilters');
  if(d){ if(nearFiltersOpen) d.removeAttribute('hidden'); else d.setAttribute('hidden',''); }
  if(btn) btn.setAttribute('aria-expanded',String(nearFiltersOpen));
}
function nearControlsHTML(){
  const rchips=NEAR_RADII.map(r=>`<button class="rchip${nearState.radius===r?' on':''}" onclick="setNearRadius(${r})">${r}km</button>`).join('');
  // 種別はマルチ選択（複数チップON可）。「すべて」は未選択時にON、個別クラスは選択集合に入っていればON。
  const cchips=NEAR_CLASSES.map(([k,l])=>{ const on = k ? nearClasses.includes(k) : !nearClasses.length; return `<button class="cchip${on?' on':''}" onclick="setNearClass('${k}')">${l}</button>`; }).join('');
  // 並びはプルダウンでなくチップ式（半径/種別と操作感を統一）。
  const schips=[['count','記録の多い順'],['name','名前順'],['cls','分類ごと'],['threat','絶滅危機順']]
    .map(([v,l])=>`<button class="cchip${nearSort===v?' on':''}" onclick="setNearSort('${v}')">${l}</button>`).join('');
  // 表示数コントロール：PC=スライダー／スマホ=チップ。右に「いま表示中／上限」を表示。
  const found=(nearRows&&nearRows.length)||0;
  const capchips=[['少なめ',12],['標準',24],['多め',40]].map(([l,n])=>`<button class="cchip${nearCap===n?' on':''}" onclick="setNearCap(${n})">${l}</button>`).join('');
  return `<div class="nearctl">
    <button class="nbtn nearfiltoggle" id="nearFilToggle" aria-expanded="${nearFiltersOpen}" aria-controls="nearfilters" onclick="toggleNearFilters(this)">⚙ しぼりこみ（半径・種別・並び・表示数）</button>
    <div class="nearfilters" id="nearfilters"${nearFiltersOpen?'':' hidden'}>
      <div class="ctlrow"><span class="ctll">半径</span><div class="rchips">${rchips}</div></div>
      <div class="ctlrow"><span class="ctll">種別</span><div class="cchips">${cchips}</div></div>
      <div class="ctlrow"><span class="ctll">並び</span><div class="cchips">${schips}</div></div>
      <div class="ctlrow"><span class="ctll">表示数</span><div class="capctl">
        <input class="caprange pc-only" type="range" min="${NEARCAP_MIN}" max="${NEARCAP_MAX}" step="2" value="${nearCap}" oninput="capLive(this.value)" onchange="setNearCap(this.value)" aria-label="近くの表示数（アイコンと一覧の上限）">
        <div class="capchips mob-only">${capchips}</div>
        <span class="capnum" title="いま表示中 / 表示上限">🐾 ${found}<span class="capsep">/</span><b>${nearCap}</b></span>
      </div></div>
    </div>
    <div class="ctlrow ctlbtns"><button class="nbtn" onclick="openAddrSearch()">🔍 住所で移動</button><button class="nbtn" onclick="recenterCurrent()">📍 現在地</button><button class="nbtn" onclick="armNearPick()">📌 タップで移動</button><button class="nbtn" onclick="shareNearCard(this)">📤 シェア</button></div>
  </div>`;
}
function renderNearList(overrideInner){
  if(!nearState)return;
  const controls=nearControlsHTML();
  if(overrideInner){ renderNearShell(nearState.label+'の近く', controls+overrideInner); openPanel(); return; }
  nearSortRows();   // ⑤ 並び替え（既定＝記録の多い順）
  const rows=nearRows.map((c,i)=>{const sci=c.name, e=encodeURIComponent(sci);
    const cat=animalBySci(sci); const rowJa=(cat&&cat.nameJa)||c.ja||'…';   // ② 図鑑収録種は図鑑の和名で統一
    return `<button class="locrow nearrow" data-sci="${esc(sci)}" data-cnt="${c.count}" data-i="${i}" onclick="openNearDetail(this)">
      <span class="locav" data-sci="${e}">🐾</span>
      <span class="ln2"><b class="nja">${esc(rowJa)}</b><span class="nsci">${esc(sci)}</span></span>
      ${cat?'<span class="catbadge" title="図鑑に収録">📖</span>':''}
      <span class="cnt2">${fmtN(c.count)}件</span></button>`;}).join('');
  renderNearShell(nearState.label+'の近く',
    controls+
    `<div class="nearsum" id="nearsum">この範囲で記録の多い脊椎動物 <b>${nearRows.length}種</b><br><span style="color:#9fb0bd">半径${nearState.radius}km・GBIFの記録（タップで詳細／📖は図鑑収録）</span></div>
     <div class="locsp" id="nearlist">${rows}</div>`);
  openPanel(); resolveAllRows();
}
// ④ 重さ対策：一覧が出た瞬間に全行(最大45)のiNat/IUCNを一斉解決しない。IntersectionObserverで
//   「見えている行だけ」を遅延解決し、applyNearFilterはrAFでデバウンス（解決ごとのO(n^2)再走査を回避）。
let _nearIO=null, _nearFilterQ=false;
function scheduleNearFilter(){ if(_nearFilterQ) return; _nearFilterQ=true; requestAnimationFrame(()=>{ _nearFilterQ=false; applyNearFilter(); }); }
function resolveRow(i){ const c=nearRows[i]; if(!c||c.done||c.loading) return; c.loading=true;
  inatEnqueue(async()=>{ const v=await inatResolve(c.name); Object.assign(c,v); c.st2=await resolveIucn(c.name); c.done=true; c.loading=false; applyRowDom(i); scheduleNearFilter(); }); }
function resolveRemainingRows(){ nearRows.forEach((c,i)=>{ if(!c.done&&!c.loading) resolveRow(i); }); }   // 絶滅危機フィルタ/並び替えで全解決が要るとき
function resolveAllRows(){
  if(_nearIO){ _nearIO.disconnect(); _nearIO=null; }
  nearRows.forEach((c,i)=>{ if(c.done) applyRowDom(i); });   // 解決済みは即描画
  const root=document.querySelector('#nearlist');
  if(('IntersectionObserver' in window) && root){
    const scroller=root.closest('.panel')||null;
    _nearIO=new IntersectionObserver(ents=>{ ents.forEach(en=>{ if(en.isIntersecting){ _nearIO.unobserve(en.target); resolveRow(+en.target.dataset.i); } }); }, {root:scroller, rootMargin:'160px'});
    root.querySelectorAll('.nearrow').forEach(el=>{ const c=nearRows[+el.dataset.i]; if(!c||!c.done) _nearIO.observe(el); });
  } else { resolveRemainingRows(); }   // 非対応は従来どおり全解決
  scheduleNearFilter();
}
function applyRowDom(i){
  const row=document.querySelector(`#nearlist .nearrow[data-i="${i}"]`); if(!row)return;
  const c=nearRows[i], av=row.querySelector('.locav'), ja=row.querySelector('.nja');
  const cat=animalBySci(c.name), nm=(cat&&cat.nameJa)||c.ja||'（和名なし）';   // ② 図鑑名優先
  if(c.ph&&av&&!av.querySelector('img')) av.innerHTML=`<img src="${esc(c.ph)}" alt="${esc(nm)}" loading="lazy" onload="this.style.opacity=1">`;
  if(ja) ja.textContent=nm;
  row.dataset.ic=c.ic||''; row.dataset.th=THREAT_CATS.has(c.st2)?'1':'';
  // 保全状況ピル（絶滅危惧VU/EN/CRのみ強調＝レア度カラー）
  if(THREAT_CATS.has(c.st2) && RARITY[c.st2]){
    let pill=row.querySelector('.stpill');
    if(!pill){ pill=document.createElement('span'); pill.className='stpill'; row.insertBefore(pill,row.querySelector('.cnt2')); }
    pill.style.background=RARITY[c.st2].color; pill.textContent='⚠'+c.st2; pill.title=RARITY[c.st2].jp+'（絶滅危惧）';
    row.classList.add('threat');
  }
}
function toggleNearThreat(){ nearThreatOnly=!nearThreatOnly; if(nearThreatOnly) resolveRemainingRows(); applyNearFilter(); }   // 絶滅危機の判定はIUCN解決が要る＝ON時に残りも解決
function applyNearFilter(){
  let vis=0, thCount=0;
  document.querySelectorAll('#nearlist .nearrow').forEach(row=>{
    const c=nearRows[+row.dataset.i]; const th=THREAT_CATS.has(c.st2); if(th)thCount++;
    const show=(!nearThreatOnly||th);   // クラス絞りはクエリ側で実施済（classMatch廃止）。ここは絶滅危惧トグルのみ
    row.style.display=show?'':'none'; if(show)vis++;
  });
  const sum=document.getElementById('nearsum'); if(!sum)return;
  const thChip=`<button class="thsum${nearThreatOnly?' on':''}" onclick="toggleNearThreat()">⚠ 近くの絶滅危惧 <b>${thCount}</b>種${nearThreatOnly?'（解除）':''}</button>`;
  let head;
  if(nearThreatOnly) head=`この範囲の<b>絶滅危惧</b> <b>${vis}種</b>`;
  else if(nearClasses.length){ head=`<b>${nearClassLabel()}</b>でしぼり込み <b>${vis}種</b>`; }
  else head=`この範囲で記録の多い脊椎動物 <b>${nearRows.length}種</b>`;
  sum.innerHTML=`${head}<br>${thChip}<br><span style="color:#9fb0bd">半径${nearState.radius}km・GBIFの記録（タップで詳細／📖は図鑑収録）</span>`;
}
/* ==== 近くの生き物 詳細（上部タブ：📍近く / 📖図鑑）====
   近くのアイコン/一覧から開く詳細パネル。図鑑収録種は上部タブで「近く情報」と
   「図鑑カード（renderAnimalCard）」を地図を動かさずに切り替えられる。
   図鑑タブでは「🛰️ この地点の分布メッシュ」トグルでGBIFヘックスを現在地の地図に重ねられる。 */
let nearFig=null, figGbifOn=false;   // nearFig={sci,cnt,i,hit,tab} ／ figGbifOn=図鑑タブの分布メッシュ表示中か
// 詳細パネル上部の共通ヘッダ（一覧へ戻る＋図鑑収録種ならタブ）。図鑑カードにも同じヘッダを差し込む。
function figHeaderHTML(active){
  const tabs=(nearFig&&nearFig.hit)?`<div class="figtabs" role="tablist" aria-label="表示を切り替え">
      <button class="figtab${active==='near'?' on':''}" role="tab" aria-selected="${active==='near'}" onclick="showFigTab('near')">📍 近く</button>
      <button class="figtab${active==='zukan'?' on':''}" role="tab" aria-selected="${active==='zukan'}" onclick="showFigTab('zukan')">📖 図鑑</button>
    </div>`:'';
  return `<button class="nbback" onclick="backToNear()">← 一覧へ</button>${tabs}`;
}
function openNearDetail(btn){
  const i=+btn.dataset.i;
  const c=nearRows[i]||{name:btn.dataset.sci,count:+btn.dataset.cnt};
  openFigDetail(c.name, c.count, i);
}
// 近くモードのグループキー／GBIFクラス名のうち「魚」に当たるもの（＝季節・観測点・メッシュを WILD 条件で引く）
const FISH_GCLS=new Set(['Fish','Actinopterygii','Chondrichthyes','Elasmobranchii','Teleostei']);
// OBIS の魚グループに混ざりうる非魚（OBIS_TAXA はクジラ類 2688 を含む）。この実クラスなら魚扱いしない。
const NON_FISH_OCLS=new Set(['Mammalia','Aves','Reptilia']);
// 生き物アイコン/一覧行からの詳細を開く共通入口。図鑑収録種は hit を持たせタブを出す。地図は動かさない。
function openFigDetail(sci, cnt, i, cls){
  const hit=ANIMALS.find(a=>(a.nameSci||'').split(' ').slice(0,2).join(' ').toLowerCase()===String(sci).toLowerCase());
  const row=nearRows[i];   // i=-1（一覧に無い＝マーカー由来）なら undefined
  // 魚は一覧/マーカーと同じ広い basis で引く。ただし OBIS併合行は魚グループでも実体がクジラのことがある
  // （OBIS_TAXA にクジラ類を含むため）ので、実クラス(ocls)が哺乳類なら魚扱いしない。
  // ocls が未知の魚クラス（ギンザメ Holocephali 等）でも従来どおり gcls='Fish' で wide になる。
  const wide=hit ? isWideBasis(hit)
    : (row&&NON_FISH_OCLS.has(row.ocls||'')) ? false
    : (FISH_GCLS.has(cls||'')||!!(row&&FISH_GCLS.has(row.gcls||'')));
  nearFig={sci, cnt, i, hit, wide, tab:'near'};
  figGbifOn=false; removeGbif();
  renderFigNear();
}
// タブ切替：📍近く＝近く情報を再描画／📖図鑑＝図鑑カード。近くへ戻る時は重ねた分布メッシュを消す。
function showFigTab(tab){
  if(!nearFig) return;
  if(tab==='zukan'){ nearFig.tab='zukan'; showFigZukan(); }
  else { removeGbif(); figGbifOn=false; renderFigNear(); }
}
// 「近く」タブ＝iNat写真・季節・時間帯・観測スポット等（地図は現在地のまま）
function renderFigNear(){
  if(!nearFig) return;
  nearFig.tab='near';
  const sci=nearFig.sci, cnt=nearFig.cnt;
  const c=nearRows[nearFig.i]||{name:sci,count:cnt};
  panelSheet(true);
  renderNearShell(sci,'<div class="nearsum">情報を読み込んでいます…</div>'); openPanel();
  inatResolve(sci).then(v=>{
    if(!currentMode||currentMode.type!=='near'||!nearFig||nearFig.tab!=='near')return;   // 待機中にモード/タブが変わったら破棄
    Object.assign(c,v,{done:true});
    const cls=NEAR_ICONIC[v.ic]||'';
    const dispJa=(nearFig.hit&&nearFig.hit.nameJa)||v.ja||'（和名なし）';   // ② 図鑑収録種は図鑑の和名を表示（iNat和名と統一）
    panelEl.innerHTML=`<button class="pclose" onclick="closePanel()" aria-label="閉じる">✕</button><div class="grab"></div>
      ${figHeaderHTML('near')}
      <div class="nd">
        ${v.ph?`<img class="ndimg" src="${esc(v.ph.replace('/square.','/medium.'))}" alt="${esc(dispJa)}" onerror="this.src='${esc(v.ph)}'">`:'<div class="ndimg ndnoimg">🐾</div>'}
        ${v.at?`<div class="ndcred">📷 ${esc(v.at)}（iNaturalist）</div>`:''}
        <div class="ndja">${esc(dispJa)}</div>
        <div class="ndsci">${esc(sci)}</div>
        <div class="ndtags">${cls?`<span class="ndtag">${cls}</span>`:''}<span class="ndtag">この範囲で ${fmtN(cnt)}件</span><span id="ndstatus"></span></div>
        ${nearFig.hit?`<button class="nbtn wide seenbtn" id="seenBtn" onclick="openSeen('${nearFig.hit.id}')">${seenBtnLabel(nearFig.hit.id)}</button>`:''}
        <div class="ndsec"><div class="ndsech">📅 観察が多い月（出会いやすさの目安）</div><div id="seasonwrap" class="seasonwrap"><span class="muted">読み込み中…</span></div></div>
        <div class="ndsec"><div class="ndsech">🕐 観察が多い時間帯（朝・昼・夕の目安）</div><div id="timewrap" class="seasonwrap"><span class="muted">読み込み中…</span></div></div>
        ${(v.id && vocalizes(v.ic) && v.exact!==false)?`<div class="ndsec" id="ndsound"><button class="nbtn wide" onclick="playNearSound(${v.id},this)">🔊 鳴き声を聞く</button></div>`:''}
        <button class="nbtn wide" id="ptsBtn" onclick="toggleNearPoints('${sciKey(sci)}',this,${nearFig.wide?1:0})">${ptsBtnLabel(nearFig.wide)}</button>
        ${nearFig.hit?'':`<button class="nbtn wide" onclick="shareSpeciesCard('${sciKey(sci)}',this)">📤 この種をシェア</button>`}
        <p class="ndnote">あなたの範囲（半径${nearState?nearState.radius:''}km）でGBIFに記録された生き物です。出会えるかは季節・時間帯によります。写真は iNaturalist（CC）。${nearFig.hit?'<br>📖<b>図鑑</b>タブで詳しい図鑑カードと分布メッシュが見られます。':''}</p>
        <a class="cta" target="_blank" rel="noopener" href="https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(sci)}">iNaturalistで詳しく見る ↗</a><br>
        <a class="ndlink" target="_blank" rel="noopener" href="https://www.gbif.org/species/search?q=${encodeURIComponent(sci)}">GBIFで記録を見る ↗</a>
      </div>`;
    openPanel(); loadSeason(sci, nearFig.wide); loadTimeOfDay(v.id);   // 鳴き声はボタン（playNearSound）でオンデマンド取得＝自動fetchしない
    resolveIucn(sci).then(code=>{ const el=document.getElementById('ndstatus'); if(!el||!code||!RARITY[code])return;
      const th=THREAT_CATS.has(code), r=RARITY[code];
      el.outerHTML=`<span class="ndtag" style="background:${r.color};color:#06231f;border-color:${r.color}">${th?'⚠ ':''}保全：${r.jp}（${code}）</span>`;
      c.st2=code; });
  });
}
// 「図鑑」タブ＝図鑑カード（renderAnimalCard）を地図を動かさずに表示。分布メッシュはトグルで任意に重ねる。
async function showFigZukan(){
  const hit=nearFig&&nearFig.hit; if(!hit) return;
  const a=await DATA.getAnimal(hit.id); if(!a){ toast('📖','図鑑データを読み込めませんでした',1800); return; }
  await ensureDetail();
  if(!nearFig||nearFig.tab!=='zukan'||!currentMode||currentMode.type!=='near') return;   // 待機中にタブ/モードが変わったら破棄
  renderAnimalCard(a, figHeaderHTML('zukan'));   // ★flyTo/removeNearbyVisuals はしない＝近くの地図と生き物を保つ
  markSeen(a.id);
}
// 図鑑タブ内トグル：この地点の地図にGBIF分布ヘックスを重ねる/消す（現在地のまま＝寄れば局所分布、引けば広域が見える）
function toggleFigDist(btn){
  const hit=nearFig&&nearFig.hit;
  if(!hit||!hit.gbif){ toast('🛰️','この種の分布データがありません',1800); return; }
  figGbifOn=!figGbifOn;
  if(figGbifOn){ addGbif(hit.gbif, isWideBasis(hit)); btn.classList.add('on'); btn.textContent='🛰️ 分布メッシュを消す'; }
  else { removeGbif(); btn.classList.remove('on'); btn.textContent='🛰️ この地点の分布メッシュを表示'; }
}
function backToNear(){ removeNearPoints(); removeGbif(); figGbifOn=false; nearFig=null; if(nearState) renderNearList(); }
// 季節性：その種の月別記録数（geoDistance内）を取得して棒グラフ。
// ここが問うのは「いつ会いやすいか」＝人が目撃した月なので、標本は混ぜない。
// 標本の採集月は「その月に調査に出た」という採集努力の偏りで、出会いやすさとは別物
// （実測：相模湾のマダイは人の目撃だけだとピーク5月・標本を混ぜると10月へ動く）。
// ただし魚は目撃が0件になりがちなので、その場合だけ標本・調査記録に頼って空表示を避ける
// （実測：ブリは相模湾で人の目撃0件・標本4件）。
async function loadSeason(sci, wide){
  const wrap=document.getElementById('seasonwrap'); if(!wrap||!nearState)return;
  const key=await resolveSpeciesKey(sci); const {lat,lng,radius}=nearState;
  if(!key){ wrap.innerHTML='<span class="muted">季節データを取得できませんでした。</span>'; return; }
  const monthCounts=async(basis)=>{
    const u=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km&taxonKey=${key}&hasCoordinate=true${basis}&limit=0&facet=month&facetLimit=12`;
    const d=await (await fetch(u)).json();
    return (d.facets&&d.facets[0]&&d.facets[0].counts)||[];
  };
  try{
    let counts=await monthCounts(GBIF_HUMAN_Q);                 // まず人の目撃だけ＝旬の純度を保つ
    if(document.getElementById('seasonwrap')!==wrap)return;     // 待機中にパネルが差し替わっていたら、2本目を投げずに破棄
    if(!counts.length && wide) counts=await monthCounts(GBIF_WILD_Q);   // 目撃ゼロの魚だけ標本にフォールバック
    if(document.getElementById('seasonwrap')!==wrap)return;
    if(!counts.length){ wrap.innerHTML='<span class="muted">この範囲では月別の記録が十分ありません。</span>'; return; }
    const months=Array(12).fill(0); counts.forEach(c=>{const m=+c.name; if(m>=1&&m<=12)months[m-1]=c.count;});
    wrap.innerHTML=renderSeasonBars(months);
  }catch(e){ wrap.innerHTML='<span class="muted">季節データの取得に失敗しました。</span>'; }
}
// 時間帯：iNat に hour_of_day ヒストグラムが無いため、観測サンプル(最大200件)の observed_on_details.hour
// （各観測の現地時刻）を時間帯別に集計。「朝・昼・夕いつ観察が多いか」の目安（その種・世界全体）。
async function loadTimeOfDay(inatId){
  const wrap=document.getElementById('timewrap'); if(!wrap)return;
  if(!inatId){ wrap.innerHTML='<span class="muted">時間帯データを取得できませんでした。</span>'; return; }
  try{
    const u=`https://api.inaturalist.org/v1/observations?taxon_id=${inatId}&quality_grade=research&per_page=200&order_by=created_at`;
    const d=await (await fetch(u)).json();
    if(document.getElementById('timewrap')!==wrap)return;
    const hours=Array(24).fill(0); let n=0;
    (d.results||[]).forEach(o=>{ const h=o.observed_on_details&&o.observed_on_details.hour; if(typeof h==='number'&&h>=0&&h<24){ hours[h]++; n++; } });
    if(n<10){ wrap.innerHTML='<span class="muted">時間帯の記録が十分ありません。</span>'; return; }
    wrap.innerHTML=renderHourBars(hours);
  }catch(e){ wrap.innerHTML='<span class="muted">時間帯データの取得に失敗しました。</span>'; }
}
function renderHourBars(hours){
  const max=Math.max(1,...hours), peak=hours.indexOf(max), nowH=new Date().getHours();   // 現在時も強調
  const period = peak<5?'未明':peak<9?'早朝':peak<11?'朝':peak<14?'昼':peak<17?'午後':peak<20?'夕方':'夜';
  const bars='<div class="sbars hbars">'+hours.map((c,i)=>{const h=Math.round(c/max*100),pk=c>=max*0.8,now=i===nowH;
    return `<div class="sbar${now?' now':''}" title="${i}時台: ${c}件${now?'（今ごろ）':''}"><div class="sbv${pk?' pk':''}${now?' cur':''}" style="height:${Math.max(4,h)}%"></div><div class="sbl">${i%6===0?i:''}</div></div>`;}).join('');
  return bars+`</div><div class="snote">観察が多いのは <b>${peak}時ごろ（${period}）</b>。iNaturalistの観察時刻分布（人が見た時間の傾向を含む）。</div>`;
}
/* ---------- 鳴き声・音（iNaturalistのCC録音を再生＝五感を追加）----------
   observations?sounds=true でCC録音を1件取り、<audio> で再生。無ければ何も出さない（graceful）。
   near詳細（inat id 既知）と種カード（学名→inatResolve）で共用。永続rAFなし・ユーザー操作起点で再生。 */
async function fetchInatSound(taxonId){
  if(!taxonId) return null;
  const base=`https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&sounds=true&license=cc-by,cc-by-nc,cc-by-sa,cc-by-nc-sa,cc0&per_page=1&order_by=votes&order=desc`;
  const tryFetch=async(extra)=>{ try{ const d=await (await fetch(base+extra)).json();
    const o=d.results&&d.results[0], s=o&&o.sounds&&o.sounds[0];
    return (s&&s.file_url)?{ url:s.file_url, at:(s.attribution||'').replace(/<[^>]*>/g,'').replace(/\(c\)/gi,'©') }:null;
  }catch(e){ return null; } };
  // まず研究グレード（同定が確定した観測＝誤同定の鳴き声を避ける）→ 無ければ通常
  return (await tryFetch('&quality_grade=research')) || (await tryFetch(''));
}
function mountSound(mount, snd){
  if(!mount||!snd) return;
  mount.innerHTML=`<div class="ndsech">🔊 鳴き声・環境音（iNaturalist・CC）</div>
    <audio class="ndaudio" controls preload="none" src="${esc(snd.url)}"></audio>
    ${snd.at?`<div class="ndcred">🎙 ${esc(snd.at)}</div>`:''}`;
  mount.hidden=false;
}
// 鳴き声はオンデマンド（ボタンクリックで取得）＝カード表示ごとの自動fetchを避けて軽量化。
async function playFigureSound(id, btn){
  const a=(typeof ANIMALS!=='undefined'&&ANIMALS.find)?ANIMALS.find(x=>x.id===id):null; if(!a||!btn) return;
  btn.disabled=true; btn.textContent='🔊 読み込み中…';
  try{ const v=await inatResolve(a.nameSci);
    if(currentAnimal!==a) return;   // 別の種へ移った
    // 発声しない分類（植物/魚/爬虫/貝など）や、iNatで別種一致（環境音・誤同定の鳴き声を掴む）は鳴き声を出さない②
    if(!v||!v.id||!vocalizes(v.ic)||v.exact===false){ btn.disabled=false; btn.textContent='🔇 鳴き声の記録なし'; return; }
    const snd=await fetchInatSound(v.id);
    if(currentAnimal!==a) return;
    const wrap=btn.parentNode;
    if(snd&&wrap){ mountSound(wrap,snd); const au=wrap.querySelector('audio'); if(au){try{au.play();}catch(e){}} }
    else { btn.disabled=false; btn.textContent='🔇 鳴き声の記録なし'; }
  }catch(e){ btn.disabled=false; btn.textContent='🔊 鳴き声を聞く'; }
}
async function playNearSound(inatId, btn){
  if(!btn) return; btn.disabled=true; btn.textContent='🔊 読み込み中…';
  try{ const snd=inatId?await fetchInatSound(inatId):null; const wrap=btn.parentNode;
    if(snd&&wrap){ mountSound(wrap,snd); const au=wrap.querySelector('audio'); if(au){try{au.play();}catch(e){}} }
    else { btn.disabled=false; btn.textContent='🔇 鳴き声の記録なし'; }
  }catch(e){ btn.disabled=false; btn.textContent='🔊 鳴き声を聞く'; }
}
// 半径円（近似ポリゴン）
function circlePolygon(lat,lng,km,pts=64){
  const R=6371,d=km/R,la=lat*Math.PI/180,lo=lng*Math.PI/180,co=[];
  for(let i=0;i<=pts;i++){ const b=2*Math.PI*i/pts;
    const la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
    const lo2=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));
    co.push([lo2*180/Math.PI,la2*180/Math.PI]); }
  return {type:'Feature',geometry:{type:'Polygon',coordinates:[co]}};
}
function renderSeasonBars(months){
  const max=Math.max(1,...months), L=['1','2','3','4','5','6','7','8','9','10','11','12'];
  const cur=new Date().getMonth();   // 現在月(0-11)＝「今が旬か」の文脈を与える（新規fetch不要）
  const peak=months.indexOf(max)+1, hot=months[cur]>=max*0.75;
  const bars='<div class="sbars">'+months.map((c,i)=>{const h=Math.round(c/max*100),pk=c>=max*0.75,now=i===cur;
    return `<div class="sbar${now?' now':''}" title="${L[i]}月: ${c}件${now?'（今月）':''}"><div class="sbv${pk?' pk':''}${now?' cur':''}" style="height:${Math.max(5,h)}%"></div><div class="sbl">${L[i]}</div></div>`;}).join('')+'</div>';
  const note = hot ? `🎯 <b>今月（${cur+1}月）は観察の旬！</b>この範囲で記録が多い時期です（GBIF）。`
                   : `ピークは <b>${peak}月ごろ</b>。棒が高い月ほど観察記録が多い＝出会いやすい目安（GBIF）。`;
  return bars+`<div class="snote">${note}</div>`;
}
// 半径円＋📍ピン（ドラッグで移動可）
function addNearCircle(lat,lng,km){
  if(!mapReady)return; const gj=circlePolygon(lat,lng,km);
  if(map.getSource('nearc')){ map.getSource('nearc').setData(gj); return; }
  map.addSource('nearc',{type:'geojson',data:gj});
  const before=map.getLayer('c-glow')?'c-glow':undefined;
  map.addLayer({id:'nearc-fill',type:'fill',source:'nearc',paint:{'fill-color':'#34d8c6','fill-opacity':.08}},before);
  map.addLayer({id:'nearc-line',type:'line',source:'nearc',paint:{'line-color':'#34d8c6','line-width':1.6,'line-opacity':.7,'line-dasharray':[2,2]}},before);
}
function drawNearVisuals(lat,lng,km){
  addNearCircle(lat,lng,km);
  if(nearMarker)nearMarker.remove();
  const el=document.createElement('div'); el.className='nearpin'; el.textContent='📍';
  try{
    nearMarker=new maplibregl.Marker({element:el,anchor:'bottom',draggable:true}).setLngLat([lng,lat]).addTo(map);
    nearMarker.on('dragend',()=>{ const ll=nearMarker.getLngLat(); setNearPin(ll.lat,ll.lng,'指定地点',nearState?nearState.radius:NEAR_DEFAULT_R); });
  }catch(e){}
}
// 観測スポットのボタン文言（魚は標本・調査記録の地点も含むため「記録スポット」と呼ぶ＝正直さ）
function ptsBtnLabel(wide){ return wide?'📍 記録スポットを地図に表示':'📍 観測スポットを地図に表示'; }
// 観測点（観察スポット）：その種の実観測点をクラスタで重畳＝「どこで見られるか」
function addNearPoints(feats){
  if(!mapReady)return; removeNearPoints();
  map.addSource('nearpts',{type:'geojson',data:{type:'FeatureCollection',features:feats},cluster:true,clusterRadius:42,clusterMaxZoom:15});
  const before=map.getLayer('c-glow')?'c-glow':undefined;
  map.addLayer({id:'nearpts-cl',type:'circle',source:'nearpts',filter:['has','point_count'],paint:{'circle-color':'#ff9a1a','circle-opacity':.45,'circle-stroke-color':'#ffb02e','circle-stroke-width':1.2,'circle-radius':['step',['get','point_count'],13,10,18,50,26]}},before);
  map.addLayer({id:'nearpts-pt',type:'circle',source:'nearpts',filter:['!',['has','point_count']],paint:{'circle-color':'#ff7a1a','circle-radius':5,'circle-stroke-color':'#fff','circle-stroke-width':1,'circle-opacity':.9}},before);
}
function removeNearPoints(){ if(!mapReady){nearPtsOn=false;return;} ['nearpts-cl','nearpts-pt'].forEach(l=>{if(map.getLayer(l))map.removeLayer(l);}); if(map.getSource('nearpts'))map.removeSource('nearpts'); nearPtsOn=false; }
async function toggleNearPoints(sci,btn,wide){
  const off=ptsBtnLabel(wide);                       // 魚は標本地点も含むので「観測」と言い切らない
  if(nearPtsOn){ removeNearPoints(); btn.textContent=off; btn.classList.remove('on'); return; }
  if(!nearState)return; btn.textContent='読み込み中…';
  const key=await resolveSpeciesKey(sci); const {lat,lng,radius}=nearState;
  if(!key){ btn.textContent=off; toast('📍','観測点を取得できませんでした',2000); return; }
  try{
    const u=`https://api.gbif.org/v1/occurrence/search?geoDistance=${lat},${lng},${radius}km&taxonKey=${key}&hasCoordinate=true${gbifBasisQ(wide)}&limit=300`;
    const d=await (await fetch(u)).json();
    const feats=(d.results||[]).filter(o=>o.decimalLatitude!=null&&o.decimalLongitude!=null).map(o=>({type:'Feature',geometry:{type:'Point',coordinates:[o.decimalLongitude,o.decimalLatitude]},properties:{}}));
    const w=wide?'記録':'観測';
    if(!feats.length){ btn.textContent=off; toast('📍',`この範囲の${w}点は見つかりませんでした`,2200); return; }
    addNearPoints(feats); nearPtsOn=true; btn.textContent=`✓ ${w}スポット表示中（タップで消す）`; btn.classList.add('on');
    toast('📍',`${feats.length}件の${w}スポットを地図に表示しました`,2400);
  }catch(e){ btn.textContent=off; toast('📍','観測点の取得に失敗しました',2000); }
}
/* ---------- 近くの生き物マーカー（ポケGO風・地図にふわっと出現）----------
   GBIFの実観測点を1回取得→種ごとに代表座標へ集計→頻度順に上限18種だけ配置（多い時の間引き＝1種1マーカー）。
   絵文字で即出現（有限CSSアニメ）→iNat写真サムネに差し替え／絶滅危惧はレア度カラーで発光。タップで詳細。
   永続rAFは使わない（アニメはCSS有限）。 */
function removeCreatures(){ creatureMarkers.forEach(m=>{try{m.remove();}catch(e){}}); creatureMarkers=[]; }
/* ---------- 世界(概観)ビューのランダム浮遊アイコン（③）----------
   地球儀/世界地図のとき、図鑑の種を毎回ちがう顔ぶれで数体“浮遊”表示＝ぐるっと見て回る楽しさ。
   近くはローカルGBIF依存だが世界は図鑑ANIMALSの focus 座標に配置。タップで種カードへ。永続rAFは使わない。 */
let worldCreatureMarkers=[];
const WORLD_CREATURE_N=14;
function removeWorldCreatures(){ worldCreatureMarkers.forEach(m=>{try{m.remove();}catch(e){}}); worldCreatureMarkers=[]; }
function spawnWorldCreatures(){ spawnCreatureIcons(Array.isArray(ANIMALS)?ANIMALS:[], WORLD_CREATURE_N); }
// 生息環境を選んだ時：その環境の動物アイコンを世界地図に散らす。数は地図の広さ(ズーム)に応じて＝広い(低ズーム)ほど多め。
function biomeCreatureCount(z){ if(z==null) z=(mapReady&&map)?map.getZoom():2; return Math.round(Math.max(12, Math.min(28, 32 - z*3))); }
function spawnBiomeCreatures(bm, z){ spawnCreatureIcons((Array.isArray(ANIMALS)?ANIMALS:[]).filter(a=>a&&a.biome===bm), biomeCreatureCount(z)); }
// 図鑑ANIMALSの focus 座標に種アイコンを配置（絵文字→写真サムネ・タップで種カード・絶滅危惧は発光）。世界ビュー/生息環境ビューで共用。
function spawnCreatureIcons(list, n){
  removeWorldCreatures();
  if(nearPick) return;   // 位置ピッカー中は地図を純粋な地点指定サーフェスに保つ（アイコンがタップを横取りしない）
  if(!mapReady || !Array.isArray(list) || !list.length) return;
  const src=list.filter(a=>a&&a.focus&&Array.isArray(a.focus.c)&&a.focus.c.length===2);
  if(!src.length) return;
  const pick=[], used=new Set();   // ランダムにN種（重複なし・毎回シャッフル＝再訪で別の顔ぶれ）
  for(let guard=0; pick.length<Math.min(n,src.length) && guard<src.length*6; guard++){
    const a=src[Math.floor(Math.random()*src.length)];
    if(used.has(a.id)) continue; used.add(a.id); pick.push(a);
  }
  pick.forEach((a,idx)=>{
    const el=document.createElement('div'); el.className='cmk-wrap'; el.style.setProperty('--d',(idx*70)+'ms');
    const bub=document.createElement('div'); bub.className='cmk'; bub.textContent=a.emoji||'🐾';
    const lab=document.createElement('div'); lab.className='cmk-lab'; lab.innerHTML=`<b>${esc(a.nameJa)}</b>`;
    el.appendChild(bub); el.appendChild(lab);
    el.addEventListener('click',(e)=>{ e.stopPropagation(); selectAnimal(a.id); });
    let mk; try{ mk=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(a.focus.c).addTo(map); }catch(e){ return; }
    worldCreatureMarkers.push(mk);
    if(a.photo && !bub.querySelector('img')){ const img=document.createElement('img'); img.src=thumbURL(a.photo,120); img.alt=''; img.loading='lazy'; img.onload=()=>img.classList.add('on'); img.onerror=()=>{try{img.remove();}catch(e){}}; bub.appendChild(img); }   // 図鑑写真を小サムネで（.cmk は40px表示＝120pxで高DPIも足りる。原寸を丸ごと読まない）
    const rr=RARITY[a.status]; if(rr && THREAT_CATS.has(a.status)){ bub.classList.add('threat'); bub.style.setProperty('--tc',rr.color); lab.classList.add('th'); }   // 絶滅危惧は発光
  });
}
// occurrence群→マーカー候補（各クラス上位4種・座標付き）。o.species が無い記録も scientificName を二名化して拾う＝取りこぼし減。
// 観測点群の代表点＝重心にいちばん近い実観測点(medoid)。1点ならその点。
// 「最初に見つかった点」ではなく局所分布の中心へ置く＝GBIF分布ヘックスと見た目が整合する（①）。
function medoid(list){
  if(!list||!list.length) return null;
  if(list.length===1) return list[0];
  let sx=0,sy=0; for(const p of list){ sx+=p[0]; sy+=p[1]; }
  const cx=sx/list.length, cy=sy/list.length;
  let best=list[0], bd=Infinity;
  for(const p of list){ const dx=p[0]-cx, dy=p[1]-cy, d=dx*dx+dy*dy; if(d<bd){ bd=d; best=p; } }
  return best;
}
// 重み付きランダム抽出（重複なし・weight=頻度n）。多い種ほど出やすいが毎回ちがう顔ぶれ＝再訪しても新鮮（③）。
function weightedSample(items, n){
  const pool=items.slice(), out=[];
  while(out.length<n && pool.length){
    let tot=0; for(const it of pool) tot+=Math.max(1,it.n||1);
    let r=Math.random()*tot, idx=pool.length-1;
    for(let i=0;i<pool.length;i++){ r-=Math.max(1,pool[i].n||1); if(r<=0){ idx=i; break; } }
    out.push(pool.splice(idx,1)[0]);
  }
  return out;
}
function collectPicks(per, perGroup){
  const picks=[]; perGroup=perGroup||10;   // 1グループから拾う種数（単一クラス時はcapまで＝魚だけ等でもマーカーが埋まる）
  per.forEach(({g,res})=>{
    const freq={}, pts={}, cls={};
    (res||[]).forEach(o=>{ let sp=(o.species||'').trim();
      if(!sp){ const p=(o.scientificName||o.acceptedScientificName||'').trim().split(/\s+/); if(p.length>=2&&/^[A-Z][a-zé-]+$/.test(p[0])&&/^[a-zé-]+$/.test(p[1])) sp=p[0]+' '+p[1]; }
      if(!sp || o.decimalLatitude==null || o.decimalLongitude==null) return;
      freq[sp]=(freq[sp]||0)+1; (pts[sp]||(pts[sp]=[])).push([o.decimalLongitude,o.decimalLatitude]); if(!cls[sp]) cls[sp]=o.class||''; });
    const cand=Object.keys(freq).map(sp=>({sci:sp,pts:thinPoints(pts[sp]),cls:CLASS_EMOJI[cls[sp]]?cls[sp]:g.c,n:freq[sp]}));   // 各種の散らし用に数点を保持（重心＋広がる点）
    weightedSample(cand, perGroup).forEach(p=>{ if(p.pts&&p.pts.length) picks.push(p); });   // 重み付きランダムで perGroup 種
  });
  return picks;
}
function loadNearCreatures(lat,lng,radius,immediate){
  removeCreatures(); threatToastShown=false;   // 地点/半径ごとに「近所に絶滅危惧種！」トーストを一度だけ
  const k=nearKey(lat,lng,radius)+'|'+nearClsKey(); creaturesKey=k; const gen=++creatureGen;   // gen=この呼び出しの世代（座標/半径/クラスの切替でも旧バッチを破棄）
  const groups=nearGroups();   // 未選択＝脊椎5クラス／種別選択時＝その選択クラス群（複数可・🦋虫は明示選択時だけ）
  const cap=creatureCap(radius);   // ① 半径連動のマーカー上限（cached/run 両経路で使用）
  clearTimeout(creatureTimer);
  const shown=new Set();      // 既に表示した種（小文字）＝クラス間・キャッシュとの重複防止
  const pool=[];              // 候補プール（表示上限より多めに貯めてキャッシュ＝再訪ごとに別の顔ぶれを抽選）③
  const addPool=(p)=>{ const key=p.sci.toLowerCase(); if(!pool.some(q=>q.sci.toLowerCase()===key)) pool.push(p); };
  const placedOf=()=>creatureMarkers.map(m=>{const o=m.getLngLat();return [o.lng,o.lat];});   // 既存マーカー座標（散らしの基準）
  // ⑤+③ 直近に見た地点はキャッシュのプールから重み付きランダムで即マーカー化（往復ゼロ＋毎回ちがう顔ぶれ）。裏で最新を取得しプール更新。
  const cached=creatureCacheGet(k);
  if(cached&&cached.length){ const cpool=cached.filter(p=>p&&p.sci&&(Array.isArray(p.pts)||Array.isArray(p.c))); cpool.forEach(addPool);
    const placed=[], cp=[];
    for(const p of weightedSample(cpool, cap)){ const c=spreadPoint(p.pts||[p.c], placed); if(!c) continue; cp.push({sci:p.sci,cls:p.cls,n:p.n,c}); placed.push(c); }
    cp.forEach(p=>shown.add(p.sci.toLowerCase())); if(cp.length) spawnCreatures(cp,false,gen); }
  const run=()=>{
    const y2=new Date().getFullYear(), y1=y2-10;
    const stale=()=> gen!==creatureGen || creaturesKey!==k || !currentMode || currentMode.type!=='near';   // 世代/地点が変わった応答は破棄（A→B→Aの重複積み増しを防ぐ）
    let widened=false;
    // ★段階描画：クラス別 occurrence を Promise.all で束ねず、返ってきたクラスから即マーカー化。
    //   最速クラスの速度で初アイコンが出る（応答が最も遅い鳥を待たない）。空きスロット分だけ随時追加。
    const single=groups.length===1;                // クラス選択時は1グループ＝取得件数を厚めにして散らす母数を確保
    const grab=(r)=>{
      let settled=0;
      groups.forEach(g=>{
        const isFish=g.c==='Fish';   // ① 魚は GBIF(縛り緩和)＋OBIS(海洋)を併合＝外洋/海でもマーカーが出る
        const op=isFish
          ? Promise.all([gbifOccByGroup(lat,lng,r,g.keys,single?110:80,y1,y2,false), obisOcc(lat,lng,r,single?200:120)]).then(([a,b])=>a.concat(b))
          : gbifOccByGroup(lat,lng,r,g.keys,single?140:(g.c==='Aves'?60:90),y1,y2,true);
        op
          .then(res=>{ if(stale()) return;
            const fresh=collectPicks([{g,res}], single?cap:Math.ceil(cap/groups.length)+3).filter(p=>!shown.has(p.sci.toLowerCase()));
            fresh.forEach(addPool);   // プールには全候補を貯める（次回キャッシュ抽選の母数＝再訪の多様性）
            const room=cap-creatureMarkers.length; if(room<=0) return;
            // ② 広く散らす：各種を重心1点でなく、既存マーカーから最も遠い観測点へ置く（円内を埋める）
            const placed=placedOf();
            const add=[];
            for(const p of fresh){ if(add.length>=room) break; const c=spreadPoint(p.pts, placed); if(!c) continue; add.push({sci:p.sci,cls:p.cls,n:p.n,c}); placed.push(c); shown.add(p.sci.toLowerCase()); }
            if(add.length) spawnCreatures(add,true,gen);   // 既存を消さず追加（append）＝返った順に積む
          })
          .catch(()=>{})
          .finally(()=>{ settled++;
            if(settled!==groups.length) return;
            // 全クラス出そろって過疎/近すぎ＝初回描画の後ろで1段だけ半径拡大（確実にアイコン）。3倍・最大100km。
            if(!widened && !stale() && creatureMarkers.length<4 && r<80){ widened=true; grab(Math.min(r*3,100)); return; }
            if(!stale() && pool.length) creatureCacheSet(k, pool.slice(0,CREATURE_POOL));   // 候補プールを保存＝次回は別の顔ぶれを抽選
          });
      });
    };
    grab(radius);
  };
  if(immediate) run(); else creatureTimer=setTimeout(run,260);   // ★初回(地点確定)は即・半径連打はデバウンス
}
function spawnCreatures(list,append,gen){
  if(!mapReady) return; if(!append) removeCreatures();   // append=段階描画で既存を消さず積み増す
  const myKey=creaturesKey, myGen=(gen==null?creatureGen:gen);   // この生成バッチの世代。地点/半径/世代を切替えたら古いバッチの後処理はスキップ。
  const base=append?creatureMarkers.length:0;   // append時はstaggerを既存マーカー数から継続（順次出現を維持）
  list.forEach((it,idx)=>{
    const el=document.createElement('div'); el.className='cmk-wrap'; el.style.setProperty('--d',((base+idx)*60)+'ms');   // 出現stagger＝wrapに置き .cmk pop と .cmk-lab peek の両方に継承させる
    const cja=(animalBySci(it.sci)||{}).nameJa||'';   // ② 図鑑収録種は図鑑の和名を優先（iNat和名との食い違いを解消）
    const bub=document.createElement('div'); bub.className='cmk'; bub.textContent=classEmoji(it.cls);
    const lab=document.createElement('div'); lab.className='cmk-lab'; lab.innerHTML=cja?`<b>${esc(cja)}</b>`:`<i>${esc(it.sci)}</i>`;   // 出現時に数秒ピーク表示＋ホバーで和名/分類/保全
    el.appendChild(bub); el.appendChild(lab);
    el.addEventListener('click',(e)=>{ e.stopPropagation(); openCreature(it.sci,it.n,it.cls); });
    let mk; try{ mk=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(it.c).addTo(map); }catch(e){ return; }
    creatureMarkers.push(mk);
    // 写真サムネに差し替え＆ホバーラベル更新（iNat・キャッシュ/throttle 共有）。鮮度ガード＝古い世代/撤去済みは何もしない。
    inatEnqueue(async()=>{ if(myGen!==creatureGen||creaturesKey!==myKey||!bub.isConnected) return; const v=await inatResolve(it.sci);
      if(myGen!==creatureGen||creaturesKey!==myKey||!bub.isConnected) return;
      const clsLab=NEAR_ICONIC[v.ic]||'', nm=cja||v.ja;   // 図鑑名 > iNat名
      if(nm||clsLab) lab.innerHTML=(nm?`<b>${esc(nm)}</b>`:`<i>${esc(it.sci)}</i>`)+(clsLab?` <span class="cl">${clsLab}</span>`:'');
      if(v&&v.ph&&!bub.querySelector('img')){ const img=document.createElement('img'); img.src=v.ph; img.alt=''; img.onload=()=>img.classList.add('on'); bub.appendChild(img); } });
    // 近くの絶滅危惧種を強調（「近所にコレ!?」）＋ラベルにも保全状況
    resolveIucn(it.sci).then(code=>{ if(myGen!==creatureGen||creaturesKey!==myKey||!bub.isConnected) return; if(code&&THREAT_CATS.has(code)&&RARITY[code]){ bub.classList.add('threat'); bub.style.setProperty('--tc',RARITY[code].color); lab.classList.add('th'); lab.insertAdjacentHTML('afterbegin',`<span class="w">⚠${code}</span> `);
      if(!threatToastShown){ threatToastShown=true; const nm=inatGet(it.sci); toast('⚠','近所に絶滅危惧種！ '+((nm&&nm.ja)||it.sci)+'（'+code+'）',3800); } } });   // 「近所にコレ!?」の感情ピークを1地点1回だけ拾う
  });
}
function openCreature(sci,cnt,cls){
  const i=nearRows.findIndex(r=>(r.name||'').toLowerCase()===String(sci).toLowerCase());
  openFigDetail(sci, cnt, i, cls);   // 詳細パネル（図鑑収録種は上部タブで📖図鑑カードに切替可）
}
function removeNearbyVisuals(){
  nearPick=false; nearClasses=[];
  removeWorldCreatures();   // ③ 世界の浮遊アイコンも撤去（種/環境/国/近くへ移るとき）
  nearFig=null; figGbifOn=false; removeGbif();   // 図鑑タブで重ねた分布メッシュ／タブ状態も片付ける
  clearTimeout(nearTimer); clearTimeout(creatureTimer);   // 近くを離れる際は保留中の周辺/生き物クエリも取消（無駄なAPI呼出・リーク防止）
  if(localMapAutoOn){ setLocalBasemap(false); localMapAutoOn=false; }   // 自動ONした基図だけ戻す（手動🏷️ONは温存）
  removeCreatures();        // 生き物マーカーも撤去
  if(nearMarker){ try{nearMarker.remove();}catch(e){} nearMarker=null; }
  if(!mapReady)return;
  removeNearPoints();
  ['nearc-line','nearc-fill'].forEach(l=>{ if(map.getLayer(l))map.removeLayer(l); });
  if(map.getSource('nearc'))map.removeSource('nearc');
}

/* ====================================================================
   起動ビュー（ローカル起点）— Googleマップ式に「近所のリアル地図」で開く。
   ・地点リンク #@lat,lng[,radius] → その場所のローカル（共有/検証に便利）
   ・種リンク #id → 従来どおりその種を開く（SEO/シェア流入を壊さない）
   ・それ以外 → 現在地ローカル。前回の場所があれば即表示（待ち時間ゼロ・再プロンプトしない）。
     取得不可/拒否/無反応は「世界ヒートマップ＋場所選択」へ滑らかにフォールバック（クラッシュしない）。
   地球儀（世界を見る）は ⌂ ボタンで1タップ復帰＝二番手モードとして温存。
   ==================================================================== */
const LS_LASTLOC='biosphere_lastloc', LS_LOCALHINT='biosphere_localhint', LS_WELCOMED='biosphere_welcomed';
function saveLastLoc(lat,lng,radius){ try{ localStorage.setItem(LS_LASTLOC,JSON.stringify({lat,lng,radius})); }catch(e){} }
function getLastLoc(){ try{ const o=JSON.parse(localStorage.getItem(LS_LASTLOC)||'null'); return (o&&typeof o.lat==='number'&&typeof o.lng==='number')?o:null; }catch(e){ return null; } }
function bootInitialView(){
  ANALYTICS.markDay(); ANALYTICS.track('visit');   // 端末内解析：訪問（外部送信なし）
  const h=location.hash.replace('#','');
  if(h==='stats'){ startLocalBoot(); openStats(); return; }   // #stats＝自分用の解析パネル（通常起動の上に重ねる）
  // 地点ディープリンク：#@lat,lng[,radius]（例 #@35.68,139.76 や #@35.68,139.76,5）
  const m=h.match(/^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+))?$/);
  if(m){ const la=+m[1], lo=+m[2];   // 共有/改ざんリンクの不正座標はローカル起動へフォールバック（flyToへ流さない）
    if(la>=-90&&la<=90&&lo>=-180&&lo<=180){ stopSpin(); setNearPin(la,lo,'指定地点', NEAR_RADII.includes(+m[3])?+m[3]:NEAR_DEFAULT_R); return; } }
  // 種ディープリンク：#id（ANIMALSが必要なので種データ到着を待つ。無い種ならローカルへフォールバック）
  if(h){ __speciesReady.then(()=>{ if(ANIMALS.some(a=>a.id===h)) selectAnimal(h); else startLocalBoot(); }); return; }
  // 既定：現在地ローカルで開く（種データを待たず即）
  startLocalBoot();
}
function startLocalBoot(){
  stopSpin();
  const last=getLastLoc();
  // 返ってきた人：前回の場所を即表示（GPS待ちゼロ・プライバシー配慮で再プロンプトしない）。
  if(last){
    setNearPin(last.lat,last.lng,'前回の場所',last.radius||NEAR_DEFAULT_R);
    toast('📍','前回の場所を表示中。📍で現在地に更新／⌂で世界全体（地球儀）へ。',3800);
    return;
  }
  // ★初回だけ：文脈なしで位置情報を要求せず、価値提示＋2択（近所/世界）を挟む＝許可率と理解を上げる。
  //   2回目以降は従来どおり即・現在地取得（「起動=現在地auto」の決定は弱めない）。ディープリンクは bootInitialView で分岐済み＝不変。
  let welcomed; try{ welcomed=localStorage.getItem(LS_WELCOMED); }catch(e){}
  if(!welcomed){ showWelcome(); return; }
  requestLocalGeo();
}
// 現在地を取得して近所で開く（Googleマップ式）。監視タイマーで無反応でも必ずフォールバック（ヘッドレス検証も固まらない）。
function requestLocalGeo(){
  ANALYTICS.track('near_opened'); onboarding=false;   // 近所へ進んだらオンボ終了（この後の記録は通常フロー）
  if(!('geolocation' in navigator)){ bootFallback('お使いの環境では現在地を取得できません。'); return; }
  renderNearShell('近くの生き物','<div class="nearsum">現在地を確認しています…<br><span style="color:#9fb0bd">ブラウザの確認ダイアログで「許可」を選ぶと、近所の生き物が見られます。</span></div>'); openPanel();
  let settled=false;
  const finish=fn=>{ if(settled)return; settled=true; fn(); };   // 二重発火を防止（成功/失敗/監視タイマーの競合）
  navigator.geolocation.getCurrentPosition(
    pos=>finish(()=>{ setNearPin(pos.coords.latitude,pos.coords.longitude,'現在地',NEAR_DEFAULT_R); localBootHint(); }),
    err=>finish(()=>bootFallback(err&&err.code===1?'位置情報の利用が許可されませんでした。':'現在地を取得できませんでした。')),
    {enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  setTimeout(()=>finish(()=>bootFallback('現在地の確認に時間がかかっています。')),9000);
}
// ===== 初回オンボーディング（60秒で最初の"見た！"／docs/design/02.4・08 §8.3⑥）=====
// ねらい＝一見さんに「情報過多」で萎えさせず、身近な1種をタップ→記録→"ずかんが1マス埋まる快感"を即体験。
// 既存挙動は不変：表示は一度きり（LS_WELCOMED）、2回目以降・前回地点あり・ディープリンクは従来どおり自動。
let onboarding=false;         // オンボ中フラグ（初回ウェルカム表示中）
let onboardPendingSeen=false; // ★祝福は「身近な種タップ→openSeen→submitSeen」の一連の時だけ。✕でウェルカムを閉じたり地図/ドックで別モードへ離脱してフラグが残っても、通常記録では祝福を出さない（敵対レビュー確定）
// 身近で誰でも見かけやすい種（分類をばらけさせる＝鳥/虫/両生/哺乳）。存在するIDだけ描く（データ変更に強い）。
const ONBOARD_SPECIES=['corvusmacrorhynchos','spotbilledduck','whitewagtail','monshirocho','sevenspotladybird','japanesebeetle','japanesetreefrog','ieneko'];
function showWelcome(){
  try{ localStorage.setItem(LS_WELCOMED,'1'); }catch(e){}   // 表示は一度きり＝次回からは自動（従来挙動）
  ANALYTICS.track('welcome_shown'); onboarding=true;
  __speciesReady.then(()=>{ if(currentMode && currentMode.type!=='near' && currentMode.type!=='animal') drawOverview(); fillOnboardSpecies(); });   // 種到着で身近な種カードを流し込む
  renderNearShell('ようこそ',
    `<div class="wcm">
      <p class="wcm-lead">世界の生きもの <b>6,300種</b> を、地図で旅する図鑑。</p>
      <p class="wcm-sub">まずは<b>1種</b>だけ、"見た！"してみよう。最近見かけた生きものはいる？<span class="wcm-dim">（無ければ好きな1種でOK）</span></p>
      <div class="wcm-species" id="wcmSpecies"><div class="wcm-loading">読み込み中…</div></div>
      <div class="wcm-or">または、まず眺めてみる</div>
      <button class="wcm-cta" onclick="requestLocalGeo()">📍 近所の生き物を見る</button>
      <button class="wcm-alt" onclick="onboardWorld()">🌐 世界地図（地球儀）で旅する</button>
      <p class="wcm-note">位置情報は周辺の生き物を探すためだけに使い、保存・第三者送信はしません（約1kmに丸めて使用）。</p>
    </div>`);
  openPanel();
}
// 身近な種カードを描く（種データ到着後）。写真は小サムネ＝原寸を丸ごと読まない。存在しないIDはスキップ。
function fillOnboardSpecies(){
  const box=document.getElementById('wcmSpecies'); if(!box)return;
  const picks=ONBOARD_SPECIES.map(id=>ANIMALS.find(a=>a.id===id)).filter(Boolean).slice(0,8);
  box.innerHTML=picks.length?picks.map(a=>`<button class="wcm-sp" onclick="onboardSeen('${a.id}')">
      <span class="wcm-sp-ph"><span class="wcm-sp-em">${a.emoji}</span>${a.photo?`<img src="${thumbURL(a.photo,120)}" alt="" loading="lazy" onload="this.classList.add('on')" onerror="this.remove()">`:''}</span>
      <span class="wcm-sp-nm">${esc(a.nameJa)}</span></button>`).join(''):'';
}
function onboardSeen(id){ ANALYTICS.track('onboard_species_tap'); openSeen(id); onboardPendingSeen=true; }   // ★印はopenSeenの後で立てる（openSeen冒頭のcloseSeenがフラグを消すため）＝この記録だけ祝福
function onboardWorld(){ onboarding=false; resetAll(); }
// 最初の"見た！"を祝う＝ずかんが1マス埋まる快感。次の一歩（近所/Myずかん）へ誘導。祝福は一度だけ。
function welcomeCelebrate(){
  onboarding=false; ANALYTICS.track('onboard_first_seen');
  if(typeof confetti==='function') confetti();
  const lv=USER.level(), sc=USER.speciesCount();
  renderNearShell('はじめの一歩',
    `<div class="wcm">
      <p class="wcm-lead">🎉 ずかんに <b>1マス</b> 埋まった！</p>
      <div class="myd-stats" style="margin:8px 0 14px">
        <div class="myd-st"><b>Lv.${lv}</b><span>レベル</span></div>
        <div class="myd-st"><b>${sc}</b><span>見た種</span></div>
      </div>
      <p class="wcm-sub">この調子で、現実で出会った生きものを"見た！"して集めよう。まずは<b>近所</b>を探検！</p>
      <button class="wcm-cta" onclick="requestLocalGeo()">📍 近所の生き物を探す</button>
      <button class="wcm-alt" onclick="openMyDex()">📔 Myずかんを見る</button>
      <button class="wcm-alt" style="margin-top:10px" onclick="onboardWorld()">🌐 世界地図で旅する</button>
    </div>`);
  openPanel();
}
// 現在地が無い/拒否時：場所選択チップは即時、世界ヒートマップは種データ必須なので到着を待って描画
// （★デカップリングで startLocalBoot が種データ前に走り得るため。空ANIMALSでの drawOverview を防ぐ）。
function bootFallback(msg){ nearbyFallback(msg); __speciesReady.then(()=>{ if(currentMode && currentMode.type!=='near' && currentMode.type!=='animal') drawOverview(); }); }   // 種データ到着前にユーザが近く/種へ遷移していたら割り込まない（world浮遊アイコンの取り残しも防ぐ）
// 初回ローカル成功時のヒント（地球儀へ戻れることの発見性。一度きり）。
function localBootHint(){ if(localStorage.getItem(LS_LOCALHINT))return; try{localStorage.setItem(LS_LOCALHINT,'1');}catch(e){} toast('🌐','あなたの近くの生き物。⌂で世界全体（地球儀）へもどれます。',4000); }
// └───────────────────────────────────────── /nearby.js ─────────────────────────────────────────┘

// ┌───────────────────────────────────────── share.js ─────────────────────────────────────────┐
/* ---------- シェアカード（タスクB） ----------
   「あなたの近くの生き物」を画像カード化してWeb Share/保存。プライバシー：精密座標は
   出さず、Nominatim逆ジオで粗い地名のみ。写真はiNat(CORS=*)をcanvasに描画(taintしない)。 */
function loadImg(url){ return new Promise(res=>{ if(!url){res(null);return;} const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>res(im); im.onerror=()=>res(null); im.src=url; }); }
function rrect(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }
function drawCover(x,im,a,b,w,h,r){ x.save(); rrect(x,a,b,w,h,r); x.clip(); if(im){const s=Math.max(w/im.width,h/im.height),iw=im.width*s,ih=im.height*s; x.drawImage(im,a+(w-iw)/2,b+(h-ih)/2,iw,ih);}else{x.fillStyle='#16303a';x.fillRect(a,b,w,h);} x.restore(); }
function clip2(s,n){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }
async function reverseGeocode(lat,lng){
  const k='biosphere_geo_'+lat.toFixed(2)+','+lng.toFixed(2);
  try{ const c=localStorage.getItem(k); if(c!==null) return c; }catch(e){}
  try{ const j=await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=ja`)).json();
    const a=j.address||{}, place=a.city||a.town||a.county||a.suburb||a.village||a.state||''; const name=[place,a.country].filter(Boolean).join('・');
    try{localStorage.setItem(k,name);}catch(e){} return name;
  }catch(e){ return ''; }
}
async function nearPlaceName(){ if(!nearState)return 'この場所'; const l=nearState.label; if(l&&l!=='現在地'&&l!=='指定地点')return l; return (await reverseGeocode(nearState.lat,nearState.lng))||l||'この場所'; }
async function buildShareCanvas(o){
  const W=1080,H=1080,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0c1c27');g.addColorStop(1,'#06121a');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle='#34d8c6';x.fillRect(0,0,W,12);
  x.fillStyle='#eaf2f6';x.font='bold 50px sans-serif';x.fillText('🌍 BIOSPHERE',58,100);
  x.fillStyle='#9fb0bd';x.font='27px sans-serif';x.fillText('世界いきもの分布アトラス',60,142);
  x.fillStyle='#34d8c6';x.font='bold 58px sans-serif';
  x.fillText(o.figure ? ('📖 '+clip2(o.figure.biome||'いきもの図鑑',12)) : ('📍 '+clip2(o.place||'この場所',14)),56,232);
  if(o.figure){
    // 図鑑カード：写真/№/保全バッジ/和名/学名/推定生息数/生息環境。写真CORS失敗時はim=null→ソリッド背景＋絵文字。
    const f=o.figure, im=await loadImg(f.ph);
    drawCover(x,im,58,270,964,470,26);
    if(!im && f.emoji){ x.textAlign='center';x.font='200px sans-serif';x.fillStyle='rgba(255,255,255,.92)';x.fillText(f.emoji,540,575);x.textAlign='left'; }
    if(f.no){ x.fillStyle='rgba(0,0,0,.5)'; rrect(x,78,290,168,48,12); x.fill(); x.fillStyle='#eaf2f6';x.font='bold 27px sans-serif';x.fillText('№ '+String(f.no).padStart(3,'0'),96,323); }
    if(f.statusCode){ const bw=304,bx=1002-bw; x.fillStyle=f.color||'#34d8c6'; rrect(x,bx,290,bw,50,13); x.fill(); x.fillStyle='#06231f';x.font='bold 27px sans-serif';x.textAlign='center';x.fillText(clip2(f.statusJp,8)+'（'+f.statusCode+'）',bx+bw/2,324);x.textAlign='left'; }
    x.fillStyle='#eaf2f6';x.font='bold 64px sans-serif';x.fillText(clip2(f.ja||f.sci,15),60,806);
    x.fillStyle='#9fb0bd';x.font='italic 33px sans-serif';x.fillText(clip2(f.sci,32),62,854);
    x.fillStyle='#cdd9df';x.font='29px sans-serif';x.fillText('推定生息数（野生）：'+clip2(f.pop,20),62,908);
    x.fillStyle='#9fb0bd';x.font='27px sans-serif';x.fillText(clip2(f.biome,10)+(f.taxon?(' ・ '+clip2(f.taxon,16)):''),62,950);
  } else if(o.single){
    const sp=o.species[0], im=await loadImg(sp.ph);
    drawCover(x,im,58,282,964,480,26);
    x.fillStyle='#eaf2f6';x.font='bold 62px sans-serif';x.fillText(clip2(sp.ja||sp.sci,16),60,852);
    x.fillStyle='#9fb0bd';x.font='italic 33px sans-serif';x.fillText(clip2(sp.sci,30),62,902);
    x.fillStyle='#cdd9df';x.font='30px sans-serif';x.fillText('この近くで '+sp.count+'件 記録',62,952);
    if(sp.th&&sp.band){ x.fillStyle=sp.bandColor||'#ffb02e'; rrect(x,640,912,382,56,14); x.fill(); x.fillStyle='#06231f';x.font='bold 32px sans-serif';x.fillText('⚠ 絶滅危惧 '+sp.band,660,950); }
  } else {
    x.fillStyle='#cdd9df';x.font='30px sans-serif';x.fillText('周辺 半径'+o.radius+'km ・ 脊椎動物 '+o.total+'種',58,286);
    if(o.threatened>0){ x.fillStyle='#ffd089';x.font='bold 31px sans-serif';x.fillText('⚠ うち絶滅危惧 '+o.threatened+'種',58,330); }
    let y=378; for(const sp of o.species.slice(0,5)){ const im=await loadImg(sp.ph);
      drawCover(x,im,58,y,120,120,18);
      x.fillStyle=sp.th?'#ffce86':'#eaf2f6';x.font='bold 42px sans-serif';x.fillText((sp.th?'⚠ ':'')+clip2(sp.ja||sp.sci,13),200,y+52);
      x.fillStyle='#9fb0bd';x.font='italic 26px sans-serif';x.fillText(clip2(sp.sci,30),202,y+92);
      x.textAlign='right';x.fillStyle='#34d8c6';x.font='bold 30px sans-serif';x.fillText(sp.count+'件',1022,y+52);x.textAlign='left';
      y+=138;
    }
  }
  x.fillStyle='#132935';x.fillRect(0,H-94,W,94);
  x.fillStyle='#34d8c6';x.font='bold 33px sans-serif';x.fillText('ankake-web.github.io/biosphere',58,H-38);
  x.textAlign='right';x.fillStyle='#7f97a3';x.font='23px sans-serif';x.fillText(o.figure?'データ: GBIF ・ 写真: Wikimedia Commons':'データ: GBIF ・ 写真: iNaturalist (CC)',1022,H-38);x.textAlign='left';
  return cv;
}
function doShare(cv,fname,text,url){
  cv.toBlob(async(blob)=>{
    if(!blob){ toast('📤','画像の生成に失敗しました',2200); return; }
    const file=new File([blob],fname,{type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file],text,url}); }catch(e){} return; }
    showShareModal(URL.createObjectURL(blob),text,url,fname);
  },'image/png');
}
function showShareModal(imgUrl,text,url,fname){
  let m=document.getElementById('sharemodal');
  if(!m){ m=document.createElement('div'); m.id='sharemodal'; m.className='smodal'; document.body.appendChild(m); }
  m.innerHTML=`<div class="sbox"><button class="pclose" onclick="this.closest('.smodal').remove()" aria-label="閉じる">✕</button>
    <img src="${imgUrl}" class="simg" alt="シェアカード">
    <div class="srow"><a class="cta" href="${imgUrl}" download="${fname}">⬇ 画像を保存</a>
      <button class="nbtn" onclick="(navigator.clipboard&&navigator.clipboard.writeText('${url}'))?toast('🔗','リンクをコピーしました',1800):0">🔗 リンクをコピー</button></div>
    <div class="snote2">${esc(text)}<br>${esc(url)}</div></div>`;
}
async function shareNearCard(btn){
  if(!nearState||!nearRows.length){ toast('📤','まず近くの生き物を表示してください',2200); return; }
  const t0=btn?btn.textContent:''; if(btn){btn.textContent='作成中…';btn.disabled=true;}
  try{
    const place=await nearPlaceName();
    const ph=nearRows.filter(c=>c.ph);
    const pick=[...ph.filter(c=>THREAT_CATS.has(c.st2)),...ph.filter(c=>!THREAT_CATS.has(c.st2))].slice(0,5)
      .map(c=>({ja:c.ja,sci:c.name,ph:c.ph.replace('/square.','/medium.'),count:fmtN(c.count),th:THREAT_CATS.has(c.st2),band:c.st2,bandColor:RARITY[c.st2]?RARITY[c.st2].color:'#888'}));
    const threatened=nearRows.filter(c=>THREAT_CATS.has(c.st2)).length;
    const cv=await buildShareCanvas({place,species:pick,radius:nearState.radius,total:nearRows.length,threatened});
    const text=`📍${place}の近くにいる脊椎動物 ${nearRows.length}種`+(threatened?`（うち絶滅危惧${threatened}種）`:'')+' #BIOSPHERE';
    const nurl=location.origin+location.pathname+'#@'+nearState.lat+','+nearState.lng+(nearState.radius?(','+nearState.radius):'');   // 受け手がその場所に着地できる地点ディープリンク
    doShare(cv,'biosphere-near.png',text,nurl);
  }catch(e){ toast('📤','シェアカードを作成できませんでした',2200); }
  if(btn){btn.textContent=t0||'📤 シェア';btn.disabled=false;}
}
async function shareSpeciesCard(sci,btn){
  if(!nearState)return; const t0=btn?btn.textContent:''; if(btn){btn.textContent='作成中…';btn.disabled=true;}
  try{
    const place=await nearPlaceName();
    const c=nearRows.find(r=>r.name===sci)||{name:sci,count:0};
    const v=await inatResolve(sci), code=await resolveIucn(sci);
    const sp={ja:v.ja,sci,ph:(v.ph||'').replace('/square.','/medium.'),count:fmtN(c.count||0),th:THREAT_CATS.has(code),band:code,bandColor:RARITY[code]?RARITY[code].color:'#ffb02e'};
    const cv=await buildShareCanvas({place,single:true,species:[sp]});
    const text=`📍${place}の近くで見つけた ${v.ja||sci} #BIOSPHERE`;
    // 図鑑収録種は種ページ(#id)へ、未収録は地点(#@)へ着地させる
    const hit=ANIMALS.find(x=>(x.nameSci||'').split(' ').slice(0,2).join(' ').toLowerCase()===String(sci).toLowerCase());
    const surl = hit ? (location.origin+location.pathname+'#'+hit.id)
                     : (location.origin+location.pathname+'#@'+nearState.lat+','+nearState.lng+(nearState.radius?(','+nearState.radius):''));
    doShare(cv,'biosphere-species.png',text,surl);
  }catch(e){ toast('📤','シェアカードを作成できませんでした',2200); }
  if(btn){btn.textContent=t0||'📤 この種をシェア';btn.disabled=false;}
}
// 図鑑の種カードを 1080² 画像でシェア（near-me の buildShareCanvas を figure モードで流用）。
async function shareFigureCard(id, btn){
  const a=(typeof ANIMALS!=='undefined'&&ANIMALS.find)?ANIMALS.find(x=>x.id===id):null; if(!a) return;
  const t0=btn?btn.textContent:''; if(btn){btn.textContent='作成中…';btn.disabled=true;}
  try{
    const r=RARITY[a.status]||{};
    const fig={ ja:a.nameJa, sci:a.nameSci, ph:a.photo, emoji:a.emoji, no:a.no,
      pop:popOf(a), statusJp:r.jp||'', statusCode:a.status, color:r.color||'#34d8c6',
      biome:a.biome, taxon:a.taxon };
    const cv=await buildShareCanvas({figure:fig});
    const url=location.origin+location.pathname+'#'+a.id;
    const text=`${a.nameJa}（${a.nameSci}）の分布・生態 — BIOSPHERE #いきもの図鑑`;
    doShare(cv,'biosphere-'+a.id+'.png',text,url);
  }catch(e){ toast('📤','シェアカードを作成できませんでした',2200); }
  if(btn){btn.textContent=t0||'🔗 共有';btn.disabled=false;}
}
// └───────────────────────────────────────── /share.js ─────────────────────────────────────────┘

// ┌───────────────────────────────────────── app.js ─────────────────────────────────────────┐
/* ---------- ツール ---------- */
$('#nearBtn').addEventListener('click',openNearby);
{ const b=$('#myDexBtn'); if(b) b.addEventListener('click',openMyDex); }
$('#search').addEventListener('input',(e)=>{ filterState.q=e.target.value.trim().toLowerCase(); scheduleFilter(); });
wireMapSug($('#search'));   // 検索窓から住所・地名でも地図移動できるように（種の絞り込みは維持）
// モバイル：図鑑ドック内の検索窓（上部バーの検索は≤640pxで非表示）。既存 filterState.q/applyFilters に配線。
{ const ds=$('#dockSearch'); if(ds){ ds.addEventListener('input',(e)=>{ filterState.q=e.target.value.trim().toLowerCase(); scheduleFilter(); }); wireMapSug(ds); } }
let isGlobe=true;
function syncGlobeBtn(){ const g=$('#globeBtn'); if(g){ g.setAttribute('aria-pressed',String(isGlobe)); g.textContent=isGlobe?'🌐':'🗺️'; } }
$('#globeBtn').addEventListener('click',()=>{
  if(dist3D){ setDist3D(false); return; }                            // 3D（平面専用）中はまず3D解除＝地球儀に戻る
  isGlobe=!isGlobe; try{ map.setProjection({type:isGlobe?'globe':'mercator'}); }catch(e){}
  syncGlobeBtn(); toast(isGlobe?'🌐':'🗺️',isGlobe?'地球儀表示':'平面表示',1500);});
$('#gbifBtn').addEventListener('click',()=>{ gbifOn=!gbifOn;
  const w=isWideBasis(currentAnimal);   // 魚は標本・調査記録も描くので「実観測」と言わない（カード内ボタンと文言を揃える）
  toast('🛰️', gbifOn?(w?'GBIFの記録：ON':'GBIF実観測データ：ON'):(w?'GBIFの記録：OFF（手描き分布）':'実観測データ：OFF（手描き分布）'),1900);
  if(currentAnimal) paintAnimal(currentAnimal); else removeGbif();
  if(currentAnimal) setMode(animalModeText(currentAnimal));
  showYearbar(gbifOn && currentMode.type==='animal');
  syncDistBtns(); });   // カード内トグル(#cardDistBtn)とツールバー🛰️の表示を常に一致（誤誘導防止）
$('#exploreBtn').addEventListener('click',explore);
$('#homeBtn').addEventListener('click',resetAll);
$('#yearSlider').addEventListener('input',(e)=>{ stopYearPlay(); applyYear(+e.target.value); });
$('#yearPlay').addEventListener('click',()=>{ if(yearPlaying) stopYearPlay(); else startYearPlay(); });
// アトラス（地形relief）表示トグル：スタイルは入れ替えず relief レイヤーの可視性だけ切替（分布/GBIF/国境は不変）
let natMarkers=[];
function showNaturalPlaces(on){
  natMarkers.forEach(m=>m.remove()); natMarkers=[];
  if(!on||!mapReady) return;
  NATURAL_PLACES.forEach(([name,lon,lat])=>{
    const el=document.createElement('div'); el.className='natm'; el.textContent=name;
    natMarkers.push(new maplibregl.Marker({element:el}).setLngLat([lon,lat]).addTo(map));
  });
}
function setAtlas(on){ atlasOn=on; if(mapReady && map.getLayer('relief')) map.setLayoutProperty('relief','visibility',on?'visible':'none');
  showNaturalPlaces(on);   // 自然の地理ラベルもアトラス表示に連動
  const b=$('#atlasBtn'); if(b)b.setAttribute('aria-pressed',String(on)); }
// シンプル化③：基図トグルを1つに統合＝🏔️地形(アトラス)をUIから外し、基図切替は🏷️本物の地図(OFM)に一本化（コード残置＝可逆・docs/design/11-A）。ボタン不在でも壊れないよう配線をガード。
{ const bat=$('#atlasBtn'); if(bat) bat.addEventListener('click',()=>{ setAtlas(!atlasOn);
  toast(atlasOn?'🏔️':'🗺️', atlasOn?'アトラス表示：地形と地名で旅する':'ミニマル表示にもどしました',1900); }); }
// 🏷️ 本物の地図トグル：OpenFreeMapのベクター基図（街路・鉄道・地名・地形／日本語優先）を手動ON/OFF。
// 近く(ローカル)モードでは自動でONになる。setStyle不使用＝gbif/relief/near-me/countries は維持。
$('#labelBtn').addEventListener('click',()=>{ const on=!localMapOn; setLocalBasemap(on); localMapAutoOn=false;   // 手動操作＝以後、近く離脱の自動OFF対象から外す（ユーザー意思を尊重）
  toast('🗺️', on?'本物の地図：街路・鉄道・地名・地形（OpenFreeMap）':'ダーク基図にもどしました',2000); });
// 分布3D（立体）トグル：fill-extrusionはglobeでは描画されないため、3D中は自動で平面(mercator)＋傾きにし、
// OFFで地球儀に復帰。地球儀を主役に保ちつつ「立体で詳しく見る」没入オプションとして提供。
function setDist3D(on){ dist3D=on; const b=$('#d3dBtn'); if(b)b.setAttribute('aria-pressed',String(on));
  try{
    if(on){ isGlobe=false; map.setProjection({type:'mercator'}); syncGlobeBtn(); map.easeTo({pitch:55, duration:700}); }
    else  { map.easeTo({pitch:0, duration:500}); isGlobe=true; map.setProjection({type:'globe'}); syncGlobeBtn(); }
  }catch(e){}
  if(currentAnimal && gbifOn && currentAnimal.gbif) addGbif(currentAnimal.gbif, isWideBasis(currentAnimal)); }
{ const b3d=$('#d3dBtn'); if(b3d) b3d.addEventListener('click',()=>{   // シンプル化②：🧊はUIから外した（コード残置）。ボタン不在でもクラッシュしないよう配線をガード
  if(!currentAnimal && !dist3D){ toast('🧊','まず動物を選ぶと、その分布を3D（立体）で見られます',2400); return; }
  setDist3D(!dist3D);
  toast(dist3D?'🧊':'🌐', dist3D?'分布を3D（立体）で表示：高い柱ほど観測が多い（平面表示）':'地球儀にもどしました',2400); }); }
$('#dex').addEventListener('click',()=>{ const t=ANIMALS.length,n=SEEN.size; toast(n>=t?'🏆':'🧭', n>=t?'図鑑コンプリート！全種を旅しました':`図鑑 ${n}/${t} 種を発見。🎲で続きを旅しよう`,2600); });
$('#dex').addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); $('#dex').click(); } });
$('#aboutBtn').addEventListener('click',openAbout);
// モバイル：⋯「そのほかの操作」メニュー（二次操作はここの奥へ）。項目選択/外側タップで閉じる。
$('#moreBtn').addEventListener('click',(e)=>{ e.stopPropagation();
  const g=$('#moregroup'), open=g.classList.toggle('open'); $('#moreBtn').setAttribute('aria-expanded',String(open)); });
$('#moregroup').addEventListener('click',()=>{ $('#moregroup').classList.remove('open'); $('#moreBtn').setAttribute('aria-expanded','false'); });
document.addEventListener('click',()=>{ const g=$('#moregroup'); if(g&&g.classList.contains('open')){ g.classList.remove('open'); $('#moreBtn').setAttribute('aria-expanded','false'); } });
// モバイル：いきもの図鑑ドックの開閉（初期は畳む＝地図＋生き物を主役に）。初回オープン時に図鑑チップを遅延構築。
$('#dockToggle').addEventListener('click',()=>{ const d=$('#dock'), open=d.classList.toggle('open'); $('#dockToggle').setAttribute('aria-expanded',String(open));
  if(open && typeof buildChips==='function') buildChips(); });

function setMode(t){ $('#modetext').textContent=t; }
let toastT; function toast(e,msg,ms=2600){const t=$('#toast');t.innerHTML=`<span class="e">${e}</span>${msg}`;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),ms);}
function bootFail(msg){$('#boot').innerHTML=`<div class="bootwrap"><div style="font-size:40px">📡</div><div class="bt" style="margin-top:14px">読み込みエラー</div><div class="bs" style="max-width:280px;line-height:1.6">${msg}<br>ネット接続を確認して再読み込みしてください。</div></div>`;}
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ closeRedlist(); closeAbout(); closePanel();
  const g=$('#moregroup'); if(g&&g.classList.contains('open')){ g.classList.remove('open'); const b=$('#moreBtn'); if(b){b.setAttribute('aria-expanded','false');b.focus();} } } });
// モバイル幅で起動→デスクトップ幅へリサイズ/回転した際、図鑑チップが空のまま操作不能にならないよう建て直す安全網（chipsBuiltガードで多重構築なし）
addEventListener('resize',()=>{ if(typeof chipsBuilt!=='undefined' && !chipsBuilt && typeof buildChips==='function' && !matchMedia('(max-width:640px)').matches) buildChips(); },{passive:true});
// └───────────────────────────────────────── /app.js ─────────────────────────────────────────┘

// ==== インラインハンドラ(onclick等)用の window 公開（モジュールスコープの外から呼ぶため） ====
Object.assign(window, { $, NEAR_DEFAULT_R, armNearPick, backToNear, closeAbout, closeAddrSearch, closePanel, closeRedlist, esc, filterStatus, filterThreat, flyCountry, openAddrSearch, openNearDetail, openRedlist, pickAddr, playFigureSound, playNearSound, recenterCurrent, requestLocalGeo, resetAll, sciKey, searchNearAddr, selectAnimal, setNearCap, capLive, setNearClass, setNearPin, setNearRadius, setNearSort, shareAnimal, shareFigureCard, shareNearCard, shareSpeciesCard, showCountry, showFigTab, toggleFigDist, toggleNearPoints, toggleNearThreat, openSeen, closeSeen, seenPreview, submitSeen, openMyDex, closeMyDex, openStats, closeStats, onboardSeen, onboardWorld, toggleAnimalDist, toggleCardMore, toggleSortFilter, toggleNearFilters })
