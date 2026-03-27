import re

content = open('cf-app/functions/api/[[route]].ts', encoding='utf-8').read()

# 1. Replace the prompt ending with tagged format
# Find it by unique start string
old_start = '请分两步输出——第一步写铺垫草稿，第二步输出JSON。'
old_end_marker = '- event_1..6的值必须是草稿原文，不能缩短`'

start_idx = content.find(old_start)
end_idx = content.find(old_end_marker)
if start_idx == -1 or end_idx == -1:
    print(f'ERROR: start_idx={start_idx}, end_idx={end_idx}')
    exit(1)

end_idx += len(old_end_marker)

old_prompt_end = content[start_idx:end_idx]

new_prompt_end = '''请按以下标签格式输出全部内容（每个标签独占一行，紧跟内容，不要输出JSON或多余文字）：

[SUMMARY]一句话梗概（30字内，写悲剧被虐感，不写觉醒复仇）
[QI]起——开篇情境（60字内）
[CHENG]承——渣男/女二施害升级（60字内，只写对她做了什么，不写她发现了什么）
[ZHUAN]转——写女主离开的动作（60字内，是行动不是发现真相）
[HE]合——男主后来发现真相，疯狂追妻（60字内）
[DESIRE]欲望——女主最初只想要什么（40字内）
[OBSTACLE]阻碍——渣男和女二怎么施害（用①②分点，80字内）
[ACTION]行动——女主做的那件事：离开（40字内，只写离开动作，不写调查）
[ACHIEVE]达成——离开后男主追悔莫及（60字内）
[PROTAGONIST]主角势力（人物名及身份，30字内）
[ANTAGONIST]反派势力（20字内）
[BYSTANDERS]围观群众（20字内，无则写「无」）
[EMOT-ELEM]情绪点要素与转折点（用1.2.分点列举，100字内）

第一阶段铺垫（女主被虐，4个事件，每个事件写4-6句完整叙述，包含触发+对话+反应+女主处境）：
[S1E1]男主明显把女二放在女主前面的场景（4-6句，含男主说的话）
[S1E2]女二设局陷害，女主被罚（4-6句，含女二和男主的对话原话）
[S1E3]公婆/儿子/家人当面指责女主（4-6句，含至少2句家人说的原话）
[S1E4]公开场合女主被严重羞辱（4-6句，有旁观者在场）
[S1TURN]第一阶段转折点——渣男/女二做了某件让局势恶化的行动（60字内，❌禁止写女主察觉任何真相）
[S1EMOT]情绪点①：①(场景→读者情绪) ②(场景→情绪) ③(场景→情绪)

第二阶段铺垫（施害升级，4个事件，每个事件写4-6句完整叙述，比第一阶段更惨）：
[S2E1]身体或精神受到更深程度伤害（4-6句，每句有具体细节）
[S2E2]女主向某人求助，被拒绝或被反骂（4-6句，含求助对话原话）
[S2E3]女主试图反抗，结果被更惨地对待（4-6句）
[S2E4]压垮骆驼——女主情感彻底死心的那件事（4-6句，❌不是发现真相，是心死了）
[S2TURN]第二阶段转折点——女主离开的那个动作（60字内，❌不写发现真相，只写离开行动）
[S2EMOT]情绪点②：①(场景→读者情绪) ②(场景→情绪) ③(场景→情绪)

第三阶段追妻（女主已离开，全程男主视角，6个事件，每个事件写4-5句完整叙述）：
[S3E1]男主回家发现空了——看到什么、第一反应、做了什么（4-5句，男主慌乱）
[S3E2]男主疯狂找人——打给谁、被骂被拒绝、他的反应（4-5句，含对方骂他的话）
[S3E3]男主外表变狼狈——状态描写，某人见到他的反应（4-5句）
[S3E4]男主翻到触目惊心的东西——日记/B超单/录音/视频内容+崩溃细节（4-6句）
[S3E5]男主找到女主——女主的冷漠态度、男主跪求、女主说的话（4-5句）
[S3E6]男主发现女二阴谋——证据内容、男主对女二的崩溃反应（4-6句）
[S3TURN]第三阶段转折点——真相在男主面前揭露（60字内）
[S3EMOT]情绪点③：①(男主追妻爽点) ②(真相大白崩溃) ③(结局最解气)
[UP]上行情绪：1.(节点) 2.(节点) 3.(节点)
[DOWN]下行情绪：1.(节点) 2.(节点) 3.(节点)`'''

content = content[:start_idx] + new_prompt_end + content[end_idx:]
print(f'Prompt ending replaced (removed {len(old_prompt_end)} chars, added {len(new_prompt_end)} chars)')

# 2. Replace the backend parsing block
old_backend_start = '    try {\n      const parsed = parseAiJson(raw)'
old_backend_end = "    } catch (e) { return c.json({ error: `解析失败: ${(e as Error).message}`, raw }, 502) }"

b_start = content.find(old_backend_start)
b_end = content.find(old_backend_end, b_start) + len(old_backend_end)
if b_start == -1 or b_end == -1:
    print(f'ERROR: backend b_start={b_start}, b_end={b_end}')
    exit(1)

new_backend = r"""    try {
      // Parse tagged output format [TAGNAME]content
      const getTag = (tag: string): string => {
        const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\n\\[[A-Z0-9-]+\\]|$)`)
        const m = raw.match(re)
        return m ? m[1].trim() : ''
      }
      const makeSetup = (events: string[]): string =>
        events.filter(e => e && e.trim() !== '无').map((e, i) => `${'①②③④⑤⑥'[i]}${e}`).join('\n')
      const result = {
        summary: getTag('SUMMARY'),
        structure: { qi: getTag('QI'), cheng: getTag('CHENG'), zhuan: getTag('ZHUAN'), he: getTag('HE') },
        event_flow: { desire: getTag('DESIRE'), obstacle: getTag('OBSTACLE'), action: getTag('ACTION'), achieve: getTag('ACHIEVE') },
        characters: { protagonist: getTag('PROTAGONIST'), antagonist: getTag('ANTAGONIST'), bystanders: getTag('BYSTANDERS') },
        emotion_elements: getTag('EMOT-ELEM'),
        outline: [
          { segment: '前段', setup: makeSetup([getTag('S1E1'), getTag('S1E2'), getTag('S1E3'), getTag('S1E4')]), turning: getTag('S1TURN'), emotion: getTag('S1EMOT') },
          { segment: '中段', setup: makeSetup([getTag('S2E1'), getTag('S2E2'), getTag('S2E3'), getTag('S2E4')]), turning: getTag('S2TURN'), emotion: getTag('S2EMOT') },
          { segment: '后段', setup: makeSetup([getTag('S3E1'), getTag('S3E2'), getTag('S3E3'), getTag('S3E4'), getTag('S3E5'), getTag('S3E6')]), turning: getTag('S3TURN'), emotion: getTag('S3EMOT') },
        ],
        emotion_arc: { up: getTag('UP'), down: getTag('DOWN') },
      }
      if (!result.summary) return c.json({ error: '解析失败：未找到标签格式内容', raw }, 502)
      return c.json(result)
    } catch (e) { return c.json({ error: `解析失败: ${(e as Error).message}`, raw }, 502) }"""

content = content[:b_start] + new_backend + content[b_end:]
print(f'Backend parsing replaced')

open('cf-app/functions/api/[[route]].ts', 'w', encoding='utf-8').write(content)
print('File written successfully')
