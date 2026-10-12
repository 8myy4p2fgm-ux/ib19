// Editorial adaptations, not attributed forum quotes. Math and voting remain independent.
const rule=(id,section,condition,text,priority,when,source=null)=>({id,section,condition,text,priority,when,source,frequency:{scope:'render',max:1}});
export const editorialRules=[
 rule('overview-missing','overview','index missing','Пока рано обтекать. Судьи ещё не определились.',100,f=>!Number.isFinite(f.index)),
 rule('overview-rise','overview','historical delta >= 2','Судейство набирает обороты. Просьба не мешать.',90,f=>Number.isFinite(f.delta)&&f.delta>=2),
 rule('overview-fall','overview','historical delta <= -2','Что-то пошло не по методичке.',90,f=>Number.isFinite(f.delta)&&f.delta<=-2),
 rule('overview-fast','overview','speed > 0','Своих узнают издалека. Иногда даже по времени оценки.',60,f=>f.speed>0),
 rule('overview-slow','overview','speed < 0','Форум опять в очереди. Хотя вроде без очереди должны были.',60,f=>f.speed<0),
 rule('overview-even','overview','speed === 0','Все в одной очереди. Уже достижение.',20,f=>f.speed===0),
 rule('participant-fourteen','participants','count === 5 and total === 14','Не хватило одного балла. Очень содержательная история.',100,f=>f.count===5&&f.total===14),
 rule('participant-pass','participants','status === pass','15 есть. Дальше уже проблемы второго раунда.',80,f=>f.status==='pass'),
 rule('participant-fail','participants','status === fail','Во второй раунд не пустили. Судейство не сработало.',80,f=>f.status==='fail'),
 rule('participant-zero','participants','count === 0','Трек сдан. Осталось дождаться, когда об этом узнают судьи.',90,f=>f.count===0),
 rule('participant-wait','participants','pending with scores','Пока без развязки. Пятнашка сама себя не наберёт.',20,f=>f.status==='pending'&&f.count>0),
 rule('dynamics-missing','dynamics','index missing','Пока рано обтекать. Судьи ещё не определились.',100,f=>!Number.isFinite(f.index)),
 rule('dynamics-rise','dynamics','delta >= 2','Судейство набирает обороты. Просьба не мешать.',90,f=>f.delta>=2),
 rule('dynamics-fall','dynamics','delta <= -2','Что-то пошло не по методичке.',90,f=>f.delta<=-2),
 rule('dynamics-flat','dynamics','abs(delta) < .1','Всё стабильно. В том числе то, что ничего не происходит.',60,f=>Number.isFinite(f.delta)&&Math.abs(f.delta)<.1),
 rule('dynamics-small','dynamics','0.1 <= abs(delta) < 2','Потихоньку судят. Очень потихоньку.',20,f=>Number.isFinite(f.delta)&&Math.abs(f.delta)>=.1&&Math.abs(f.delta)<2),
 rule('forecast-late','forecast','rate > 0 and projected > deadline','Продлите судейство. А потом ещё раз продлите.',80,f=>f.enough&&f.rate>0&&Number.isFinite(f.deadline)&&f.projected>f.deadline),
 rule('forecast-stopped','forecast','enough and rate === 0','Как же долго судят.',70,f=>f.enough&&f.rate===0,'https://www.hip-hop.ru/forum/showpost.php?p=1081080654'),
 rule('forecast-small','forecast','insufficient history','Пока рано обещать дату. Даже обтекаемо.',60,f=>!f.enough),
 rule('forecast-okay','forecast','rate >= needRate and remaining > 0','По темпу успевают. Не спугните.',30,f=>f.remaining>0&&f.enough&&f.rate>=f.needRate&&f.needRate>0),
 rule('methodology-caption','methodology','always','Судейство — гипотеза. Таблицы — доказательная база. Ну почти.',10,()=>true),
 rule('forum-overview','forum','confirmed passes > 0','Во второй уже собираются. Остальные пока ждут судей.',30,f=>f.passed>0),
 rule('forum-empty','forum','no confirmed passes','Пятнашек пока нет. Форум на низком старте.',30,f=>f.passed===0),
 rule('low-forum-score','score','forum and score <= 3','Методичка эту оценку запомнила.',50,f=>f.forum&&f.score<=3)
];
export function createEditorialSession(){const used=new Set(),counts=new Map();return {pick:(section,facts)=>selectEditorial(section,facts,{used,counts})};}
export function selectEditorial(section,facts,{used=new Set(),counts=new Map()}={}){const match=editorialRules.filter(r=>r.section===section&&r.when(facts)&&!used.has(r.id)&&(counts.get(r.id)||0)<r.frequency.max).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id))[0];if(match){used.add(match.id);counts.set(match.id,(counts.get(match.id)||0)+1);}return match||null;}
export function voiceInline(text){return text?'<p class="editorial-caption">'+String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p>':'';}

