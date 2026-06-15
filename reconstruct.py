import json
import os
import re

transcript_path = r'C:\Users\DELL\.gemini\antigravity-ide\brain\49eb3a26-72b2-4851-a8df-bc464cee74b8\.system_generated\logs\transcript.jsonl'

lines = []
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        lines.append(json.loads(line))

def extract_file_from_view(content, filename):
    if filename not in content:
        return None
    # Extract the code block
    match = re.search(r'The following code has been modified.*?:\s(.*?)The above content', content, re.DOTALL)
    if match:
        code_block = match.group(1)
        # Remove line numbers
        restored = re.sub(r'^\d+:\s', '', code_block, flags=re.MULTILINE)
        return restored
    return None

def apply_chunks(content, chunks):
    for chunk in chunks:
        target = chunk.get('TargetContent', '')
        replacement = chunk.get('ReplacementContent', '')
        if target in content:
            content = content.replace(target, replacement, 1)
        else:
            print('TARGET NOT FOUND')
    return content

# Extract base versions from step 1871 / 1716
files_to_recover = ['Paiements.tsx', 'LoyersImpayes.tsx', 'Depenses.tsx', 'Table.tsx']
current_contents = {}

for i in range(2106, -1, -1):
    step = lines[i]
    if step.get('type') == 'VIEW_FILE' and step.get('source') == 'MODEL':
        content = step.get('content', '')
        for f in files_to_recover:
            if f not in current_contents and f in content:
                restored = extract_file_from_view(content, f)
                if restored:
                    if 'Showing lines 1 to' in content:
                        current_contents[f] = restored
                        print(f'Recovered {f} from step {i}')

# Now apply multi_replace_file_content forward
start_step = 1716
for i in range(start_step, 2107):
    step = lines[i]
    if step.get('type') == 'PLANNER_RESPONSE' and step.get('tool_calls'):
        for tc in step['tool_calls']:
            if tc['name'] == 'multi_replace_file_content':
                args = tc['args']
                if isinstance(args, str):
                    try: args = json.loads(args)
                    except: continue
                
                target_file = args.get('TargetFile', '')
                basename = os.path.basename(target_file.strip('\"\''))
                
                if basename in files_to_recover and basename in current_contents:
                    chunks = args.get('ReplacementChunks', [])
                    if isinstance(chunks, str):
                        try: chunks = json.loads(chunks)
                        except: pass
                    if chunks:
                        print(f'Applying {len(chunks)} chunks to {basename} at step {i}')
                        current_contents[basename] = apply_chunks(current_contents[basename], chunks)

for f, content in current_contents.items():
    with open(f'src/pages/{f}', 'w', encoding='utf-8') as fout:
        fout.write(content)
    print(f'Wrote restored {f} to src/pages/')
