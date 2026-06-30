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
  if(a.status==='DD'||a.status==='NE') return 'unknown';
  return 'down';
}
const TREND_META={up:{a:'↑',t:'増加',c:'#5fd39a'},down:{a:'↓',t:'減少',c:'#ff9a8a'},stable:{a:'→',t:'横ばい',c:'#9fb0bd'},unknown:{a:'–',t:'不明',c:'#9fb0bd'}};
// 高位分類（哺乳/鳥/爬虫/両生/魚/昆虫/植物/無脊椎）。図鑑の絞り込み用にidで明示（既定＝哺乳類）。
const CLASS={
  鳥類:['penguin','eagle','condor','crane','toucan','flamingo','shoebill','albatross','humboldtpenguin','kiwi','kingpenguin','ostrich','steller','peafowl','mallard','northerncardinal','kanadagan','osprey','aosagi','muteswan','pileatedwoodpecker','annashummingbird','rubythroatedhummingbird','indigobunting','peregrinefalcon','whitetailedeagle','scarlettanager','rainbowlorikeet','sulphurcrestedcockatoo','eurasianhoopoe','blackwoodpecker','goldeneagle','helmetedguineafowl','westernbarnowl','snowyowl','adeliepenguin','eurasianeagleowl','emu','scarletmacaw','beniflamingo','superblyrebird','momoiropelican','budgerigar','beardedvulture','kuroerihakucho','greycrownedcrane','greaterrhea','secretarybird','kingvulture','harpyeagle','atlanticpuffin','northerngannet','mandarinduck','albertlyrebird','quetzal','kakapo','roadrunner','ivorygull','scarletibis','frigatebird','kingfishercommon','eurasianbullfinch','japanesegrosbeak','blackfacedbunting','longtailedrosefinch','yellowthroatedbunting','blueandwhiteflycatcher','redflankedbluetail','daurianredstart','siberianrubythroat','eurasiannuthatch','longtailedtit','japanesewhiteeye','japanesebushwarbler','martialeagle','africanhawkeagle','crownedeagle','africanfisheagle','easternmarshharrier','greyfacedbuzzard','mountainhawkeagle','commonbuzzard','orientalhoneybuzzard','merlin','turkeyvulture','greathornedowl','tawnyowl','shortearedowl','spectacledowl','africangreyparrot','blueandyellowmacaw','sunparakeet','monkparakeet','galah','cockatiel','whitecockatoo','roseringedparakeet','peachfacedlovebird','salmoncrestedcockatoo','eclectusparrot','australiankingparrot','crimsonrosella','greatspottedwoodpecker','keelbilledtoucan','coppersmithbarbet','northerncassowary','mikadopheasant','greatargus','redjunglefowl','crestedpartridge','victoriacrownedpigeon','nicobarpigeon','emeralddove','greaterbirdofparadise','wilsonsbirdofparadise','rufousbelliedkookaburra','orientalcuckoo','oldworldcuckoo','ruddyshelduck','whooperswan','purpleheron','blackcrownednightheron','blackfacedspoonbill','crestedibis','whitestork','maraboustork','blackcrownedcrane','demoisellecrane','hoodedcrane','laysanalbatross','eurasiancoot','blackfootedalbatross','sootyshearwater','bluefootedbooby','redfootedbooby','brownbooby','redbilledtropicbird','redfacedcormorant','pelagiccormorant','rockhopperpenguin','magellanicpenguin','eurasiancurlew','fareasterncurlew','commonredshank','commongreenshank','ruddyturnstone','pacificgoldenplover','greyplover','blackwingedstilt','piedavocet','blackheadedgull','europeanherringgull','slatybackedgull','blacktailedgull','eurasiansiskin','hawfinch','variedtit','coaltit','redtailedhawk','hoodedvulture','cinereousvulture','griffonvulture','burrowingowl','militarymacaw','hyacinthmacaw','lesserspottedwoodpecker','europeangreenwoodpecker','eurasianwryneck','greatbarbet','europeanbeeeater','europeanroller','largehawkcuckoo','crestedkingfisher','tundraswan','barnaclegoose','cacklinggoose','lesseradjutant','saruscrane','limpkin','commonmoorhen','blackbrowedalbatross','streakedshearwater','tuftedpuffin','commonmurre','pigeonguillemot','bartailedgodwit','sanderling','dunlin','littleringedplover','kentishplover','eurasianoystercatcher','beehummingbird','swordbillhummingbird','marvelousspatuletail','bootedrackettail','littlehermit','crimsonsunbird','purplethroatedsunbird','paradisetanager','scarletbackedflowerpecker','newhollandhoneyeater','redcrestedcardinal','lazulibunting','redbilledleiothrix','redcappedmanakin','andeancockoftherock','wiretailedmanakin','scaledantpitta','rufoustailedjacamar','indianpitta','sunbittern','hoatzin','japaneseparadiseflycatcher','asianparadiseflycatcher','longtailedbroadbill','greatercrackedtaileddrongo','spangleddrongo','commonblackbird','willierfantail','mistlethrush','redwingthrush','whitesthrush','japanesewaxwing','bohemianwaxwing','japaneseaccentor','zittingcisticola','orientalreedwarbler','whitewagtail','olivebackedpipit','eurasianskylark','blacknapedoriole','eurasianjay','yellowbelliedsunbird','helmetedhoneyeater','redwingedblackbird','amazonianumbrellabird','rufoushornero','collaredtrogon','hoodedpitta','palethrush','eurasiantreecreeper','easterncrownedwarbler','goldcrest','buffbelliedpipit'],
  魚類:['clownfish','mantaray','seahorse','whaleshark','greatwhite','bullshark','oceansunfish','shortfinmako','tigershark','spottedeagleray','scallopedhammerhead','giantoceanicmantaray','indopacificsailfish','atlanticbluefintuna','sandtigershark','frilledshark','leafyseadragon','anglerfish','coelacanth','lionfish','atlanticsalmon','moorishidol','electriceel','manderinfish','tomatoclownfish','linedsurgeonfish','bluetang','threadfinbutterfly','pennantcoralfish','copperbandbutterfly','raccoonbutterfly','emperorangelfish','daisyparrotfish','torafugu','stripedeelcatfish','greathammerhead','smoothhammerhead','oceanicwhitetip','blueshark','porbeagle','commonthresher','baskingshark','megamouthshark','zebrashark','japanesewobbegong','bluntnosesixgill','nursehark','spinydogfish','kitefinshark','greenlandshark','redstingray','bullray','bluespottedribbontail','marbledelectricray','thornbackray','leopardwhipray','commonguitarfish','spottedratfish','elephantfish','bluntnosestingray','atlantictorpedo','ocellateriverstingray','humpheadwrasse','cleanerwrasse','giantgrouper','duskyshark','bigeyethresher','nishikigoi','gengorobuna','sougyo','hakuren','kawamutsu','ugui','neontetra','cardinaltetra','piranha','wels','piraiba','shimadojo','dojo','zebrafish','guppy','discus','oscarcichlid','frontosa','niletilapia','asianarowana','silverarowana','arapaima','polypterus','alligatorgar','africanlungfish','australianlungfish','electriccatfish','nothobranchius','siamesefightingfish','pearlgourami','clownknifefish','medaka','sterlet','paddlefish','muskellunge','nileperch','crestfish','barreleye','gulpereel','viperfish','lanternfish','yokozunaiwashi','alfonsino','rockfishacou','yellowfintuna','skipjacktuna','bluefintuna','swordfish','blackmarlin','mahimahi','japaneseamberjack','pacificsaury','hairtail','colossoma','mekongcatfish','corydoras','angelfish','bowfin','sablefish','sandfish'],
  爬虫類:['komodo','galapagostortoise','alligator','greenturtle','loggerhead','kingcobra','marineiguana','chameleon','saltwatercrocodile','greeniguana','leatherbackseaturtle','hawksbillseaturtle','oliveridleyturtle','spectacledcaiman','centralbeardeddragon','nilecrocodile','leopardtortoise','greenbasilisk','easterndiamondbackrattlesnake','frilledlizard','gilamonster','indiancobra','reticulatedpython','tuatara','greenanaconda','blackmamba','gharial','aldabragianttortoise','gilamonster2','perentie','tokaygecko','leopardgecko','gartersnake','cornsnake','boaconstrictor','matamata','ballpython','rainbowboa','emeraldtreeboa','gaboonviper','puffadder','cottonmouth','russellsviper','habu','deathadder','mamushi','easternbrownsnake','inlandtaipan','tigersnake','easterngreenmamba','egyptiancobra','boomslang','californiakingsnake','yellowbelliedseasnake','sulcatatortoise','pancaketortoise','easternboxturtle','japanesepondturtle','ploughsharetortoise','reevesturtle','redearedslider','alligatorsnapper','commonsnapper','chinesesoftshell','flatbackturtle','chinesealligator','blackcaiman','orinococrocodile','siamesecrocodile','muggercrocodile','japanesegecko','rhinocerosiguana','veiledchameleon','jacksonschameleon','flyingdragon','shingleback','savannahmonitor','nilemonitor','commonwalllizard','armadillolizard','sidewinder','easterncoralsnake','kempsridley','falsegharial','freshwatercrocodile','galapagoslandiguana','easternwaterdragon','bluetongueskink','watermonitor','texashornedlizard','aodaisho','shimahebi','yamakagashi','eggeatingsnake','redpipesnake','jimuguri','carpetpython','radiatedtortoise','indianstartortoise','africanhelmetedturtle','woodturtle','diamondbackterrapin','greentreepython','pignosedturtle','razorbackmusk','redbelliedshorttoise'],
  両生類:['axolotl','giantsalamander','dartfrog','firesalamander','tigersalamander','redeyedtreefrog','poisondartfrog','canetoad','surinamtoad','hellbender','smoothnewt','goliathfrog','goldenpoisonfrog','glassfrog','americanbullfrog','japanesetreefrog','forestgreentreefrog','blackspottedpondfrog','commontoad','japanesecommontoad','asianhornedfrog','argentinehornedfrog','commonspadefoottoad','darwinsfrog','goldenmantella','chinesegiantsalamander','iberianribbednewt','spottedsalamander','bandedtigersalamander','mudpuppy','twotoedamphiuma','easternnewt','greatcrestednewt','alpinenewt','redbacksalamander','europeantreefrog','tomatofrog','japanesefirebellynewt','blacksalamander'],
  昆虫:['monarch','honeybee','firefly','sevenspotladybird','paperkitebutterfly','bluemorpho','herculesbeetle','goliathusgoliatus','queenalexandrasbirdwing','dungbeetle','giantasianhornet','goldenringeddragonfly','giantstagbeetle','mincicada','asianswallowtail','chinesemantis','giantwaterbug','atlasmoth','machaon','saturniapyri','cetoniaaurata','anaxjunius','romalea','lampyris','phyllium','lucanuscervus','mikadoageha','heliconius','dokucho','kuroageha','tsumabenicho','benishijimi','monshirocho','oomurasaki','komurasaki','hyomoncho','kujakucho','himeakatateha','ruritateha','caucasusbeetle','atlasbeetle','satanbeetle','japanesebeetle','hiratastagbeetle','miyamastagbeetle','giraffestagbeetle','jewelbeetle','groundbeetle','divingbeetle','heikefirefly','tigerbeetle','ginyanma','akiakane','choutonbo','shoujou','tonosamabatta','sabakutobi','shouryou','kurumabatta','hanakamakiri','konohamushi','suzumushi','kera','japanesehoneybee','yellowhornet','carpenterbee','bumblebee','leafcutterant','fireant','slavemakerant','japanesecarpenterant','higurashicicada','tsukutsukuboushi','asagimadara','murasakishijimi','zephyrus','janomecho','akatateha','eupatorusbeetle','sawstagbeetle','cyclommatusstagbeetle','konohakamakiri','kirigirisu','kutsuwamushi','driverant','redcarpenterant'],
  植物:['baobab','sequoia','rafflesia','quercusrobur','helianthus','nelumbo','bristleconepine','coastredwood','yoshinocherry','baobab2','ginkgo','dawnredwood','yamazakura','mizunara','japanesecedar','hinokicypress','japaneseredpine','silverbirch','japaneseelm','japanesehorsechestnut','olive','corkoak','japanesemaple','eucalyptus','flametree','dragonbloodtree','tulip','noibara','jacaranda','yamayuri','asagao','higanbana','seiyotanpopo','cosmos','chrysanthemum','katakuri','sakuraso','hinageshi','edelweiss','lavender','mizubasho','watasuge','rindo','poinsettia','phalaenopsis','shakunage','dendrobium','cypripedium','paphiopedilum','sarracenia','drosera','pinguicula','utricularia','saguaro','opuntia','aloevera','lithops','haworthia','agave','warabi','zenmai','hego','echeveria','tamashida','ryubintai','sugina','zenigoke','sotetsu','onisotetsu','welwitschia','koyamaki','nagi','himalayasugi','europeanbeech','camphortree','sumire','ajisai','tsutsuji','cattleya','cymbidium','venusflytrap','sagiso','goldenbarrel','hikagenokazura','gunetum','ichii','nanyousugi','karamatsu'],
  無脊椎:['octopus','nautilus','spidercrab','americanlobster','commoncuttlefish','emperorscorpion','mexicanredknee','coconutcrab','moonjelly','giantisopod','horseshoecrab','giantclam','fireflysquid','crownofthorns','vampiresquid','bluestarfish','mantisshrimp','portugueseman','argiope','cornuaspersum','lissachatina','spanishdancer','goliathbirdeater','cobaltbluetarantula','jorospider','argiopespider','jumpingspider','huntsmanspider','bolasspider','sydneyfunnelweb','deathstalker','redheadcentipede','blackwidow','peruviangiantcentipede','giantafricanmillipede','yaeyamamillipede','atlantichorseshoecrab','taillesswhipscorpion','vinegaroon','tarabagani','kegani','zuwaigani','gazami','nokogirigazami','sawagani','mokuzugani','iseebi','europeanlobster','kurumaebi','tenagaebi','sujiebi','otohimeebi','shako','commonoctopus','dumboflapjack','blanketoctopus','blueringedoctopus','coconutoctopus','bigfinreefsquid','cuttlefish','giantsquid','diamondbacksquid','argonaut','colossalsquid','cowrie','tritonstrumpet','manilaclam','turbansnail','abalone','bluedragonnudibranch','mahitode','kobuhitode','seaangel','takonomakura','gangaze','nisekuronamako','akakurage','takokurage','habukurage','benikurage','sakasakurage','owankurage','umeboshiisoginchaku','hatagoisoginchaku','brownrecluse','sunagani','tezurumozuru','bafununi','amefurashi','ibarakanzashi','umikemushi','yumushi','hoshimushi','maboya','sarupa','hikariboya','urikurage','mokuyokukaimen','fusenkurage','hokimushi','haorimushi','kokemushi'],
};
const clsOrder=['哺乳類','鳥類','爬虫類','両生類','魚類','昆虫','植物','無脊椎'];
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
};
const ccName=(c)=>CC[c]?CC[c][0]:c;
const ccFlag=(c)=>CC[c]?CC[c][1]:'📍';

/* ---------- シードデータ（28種）---------- */
let ANIMALS = [];
// 種データは data/species.json から非同期ロード（地図はこれを待たずに即初期化）。
// ※fetch を使うため file:// 直開きは不可＝HTTP配信（GitHub Pages / localhost）が前提。
let __speciesDone; const __speciesReady = new Promise(r=>{ __speciesDone = r; });
const __spData = fetch('data/species.json').then(r=>{ if(!r.ok) throw new Error('species.json '+r.status); return r.json(); });

/* 写真クレジット（Wikimedia Commons API から取得した撮影者・ライセンス）。出典明記=ライセンス遵守 */
let PHOTO_CRED = {};
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

/* 実データ層（GBIF）：学名→taxonKeyは取得済み。
   観測密度タイル（ヘックスビン）を重ねる。ヘックスはズーム階層ごとに再計算され、
   寄るほど細かいビンになる＝国全体ベタ塗りではない「詳細分布」。 */
function gbifTileURL(taxonKey, year){
  return 'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png'
       + '?srs=EPSG:3857&taxonKey=' + taxonKey
       + '&bin=hex&hexPerTile=71&style=classic-noborder.poly'
       + '&basisOfRecord=HUMAN_OBSERVATION'    // 野外目撃中心（標本ノイズ抑制）。ヘックスはズーム階層ごとに細密化
       + (year ? ('&year=' + year) : '');      // 時系列スライダー：年代で観測を絞る
}

/* ===================================================================== */
const $=(s)=>document.querySelector(s);
let CODE_PROP='ADM0_A3', countryGeo=null, mapReady=false, spinning=true, A3toA2={};
let gbifOn=true, currentAnimal=null, currentMode={type:'overview'};
let atlasOn=false;   // アトラス表示（地形relief）のON/OFF。スタイルは入れ替えず重畳トグル
let dist3D=false;    // 分布の3D（立体）表示。GBIF MVTヘックス＋fill-extrusion（試験的）
// 低モーション/通信節約：自動回転を止めて電力・CPU・通信を節約（モバイル配慮＋アクセシビリティ）
const LOW_MOTION=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||!!(navigator.connection&&navigator.connection.saveData);
const SEEN = new Set(JSON.parse(localStorage.getItem('biosphere_seen')||'[]'));
const BADGES = new Set(JSON.parse(localStorage.getItem('biosphere_badges')||'[]'));   // 達成済みのコンプ演出（再表示しない）
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

