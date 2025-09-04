from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import json
import os
from difflib import get_close_matches

# Create the Flask application
app = Flask(__name__)

# Load API key from environment variable
gemini_api_key = os.environ.get("GEMINI_API_KEY")

if not gemini_api_key:
    # This will prevent the app from running without the key
    raise ValueError("GEMINI_API_KEY environment variable is not set. Please set it before running the app.")

genai.configure(api_key=gemini_api_key)


# Load the data file into a global variable
try:
    with open('data.json', 'r', encoding='utf-8') as f:
        data_store = json.load(f)
except FileNotFoundError:
    data_store = {}
    print("Warning: data.json file not found. Chatbot will rely solely on AI for most queries.")

# --- Helper Functions for Local Data Search and Formatting ---
def get_formatted_response(category, item):
    response = {'text': '', 'map_iframe': None, 'coords': None}

    if category == 'syllabuses':
        response['text'] = f"**Syllabus:**<br>"
        if 'urls' in item:
            response['text'] += f"**{item['name']}**<br>"
            for link in item['urls']:
                response['text'] += f"<a href='{link['url']}' target='_blank' style='color:#3b82f6; text-decoration: underline;'>{link['name']}</a><br>"
        else:
            response['text'] += f"**{item['name']}**: <a href='{item['url']}' target='_blank' style='color:#3b82f6; text-decoration: underline;'>Click here for Syllabus</a>"
    elif category == 'departments':
        response['text'] = f"**Department:** {item.get('name', 'N/A')}<br>"
        response['text'] += f"Location: {item.get('location', 'Not available')}<br>"
        
        hod_name = item.get('hod', item.get('hod_name', 'Not available'))
        if hod_name != 'Not available' and 'hod_role' in item:
            response['text'] += f"HOD: {hod_name} ({item['hod_role']})"
        else:
            response['text'] += f"HOD: {hod_name}"
            
    elif category == 'facilities':
        response['text'] = f"**Facility:** {item.get('name', 'N/A')}<br>"
        response['text'] += f"Location: {item.get('location', 'Not available')}<br>"
        response['text'] += f"Timing: {item.get('timing', 'Not available')}"
        response['coords'] = item.get('coords')
        response['map_iframe'] = item.get('map_iframe')

    elif category == 'teaching_staff':
        response['text'] = "**Teaching Staff:**<br>"
        for dept, staff_list in item.items():
            response['text'] += f"- **{dept}:** {', '.join(staff_list) if staff_list else 'No staff listed'}<br>"
    
    elif category == 'non_teaching_staff':
        response['text'] = "**Non-Teaching Staff:**<br>"
        for member in item:
            response['text'] += f"- {member.get('name', 'N/A')} ({member.get('role', 'N/A')})<br>"
            
    elif category == 'staff_member':
        response['text'] = f"**Staff Member:** {item.get('name', 'N/A')}<br>"
        response['text'] += f"Role: {item.get('role', 'N/A')}<br>"
        if item.get('department'):
            response['text'] += f"Department: {item.get('department', 'N/A')}"
            
    elif category == 'holiday_list':
        response['text'] = f"**Holiday Information:**<br>{item.get('details', 'Not available')}"

    return {'response': response}

# --- AI Integration Function ---
def ask_ai(user_query):
    if not gemini_api_key:
        return jsonify({'response': {'text': "AI service is not configured. Please contact the administrator."}})

    try:
        system_prompt = (
            "You are a helpful college campus assistant for Kisan College. "
            "Your primary goal is to answer user questions accurately and concisely. "
            "If the user's query is about a specific detail (e.g., HOD, location, syllabus), "
            "state that you can only provide information available in the college's official data. "
            "For general questions (e.g., college history, ranking), use your general knowledge to provide a helpful response."
        )
        model = genai.GenerativeModel('gemini-1.5-flash-latest', system_instruction=system_prompt)
        response = model.generate_content(f"User query: {user_query}")
        ai_response_text = response.text.strip()
        return jsonify({'response': {'text': ai_response_text}})
    except Exception as e:
        return jsonify({'response': {'text': f"An error occurred with the AI service: {e}"}})

# --- Unified Search Function ---
def search_data_store(user_query):
    query_lower = user_query.lower()

    # Priority 1: Search for specific staff members
    all_staff_names = []
    if data_store.get('staff') and data_store['staff'].get('teaching'):
        for dept, staff_list in data_store['staff']['teaching'].items():
            for name in staff_list:
                all_staff_names.append({'name': name, 'type': 'teaching', 'department': dept})
    if data_store.get('staff') and data_store['staff'].get('non_teaching'):
        for member in data_store['staff']['non_teaching']:
            all_staff_names.append({'name': member['name'], 'role': member['role'], 'type': 'non_teaching'})

    for staff_member in all_staff_names:
        if get_close_matches(query_lower, [staff_member['name'].lower()], n=1, cutoff=0.7):
            return get_formatted_response('staff_member', staff_member)

    # Priority 2: Search for department and HOD information
    department_keywords = ['department', 'hod', 'head of department', 'location']
    if any(keyword in query_lower for keyword in department_keywords) or any(get_close_matches(word, [dept['name'].lower() for dept in data_store.get('departments', [])], n=1, cutoff=0.6) for word in query_lower.split()):
        for item in data_store.get('departments', []):
            if get_close_matches(query_lower, [item['name'].lower()], n=1, cutoff=0.6) or \
               get_close_matches(query_lower, [item.get('hod', '').lower()], n=1, cutoff=0.6) or \
               get_close_matches(query_lower, [item.get('hod_name', '').lower()], n=1, cutoff=0.6):
                return get_formatted_response('departments', item)
    
    # Priority 3: Search for syllabus information
    syllabus_keywords = ['syllabus', 'course', 'curriculum']
    if any(keyword in query_lower for keyword in syllabus_keywords):
        all_syllabuses = []
        for syllabus_type in ['ug_syllabus', 'pg_syllabus']:
            all_syllabuses.extend(data_store.get('syllabuses', {}).get(syllabus_type, []))
        
        for item in all_syllabuses:
            if 'name' in item and any(get_close_matches(word, item['name'].lower().split(), n=1, cutoff=0.6) for word in query_lower.split()):
                return get_formatted_response('syllabuses', item)

    # Priority 4: Search for facility information
    facility_keywords = ['facility', 'canteen', 'health centre', 'map', 'kisan college']
    if any(keyword in query_lower for keyword in facility_keywords):
        for item in data_store.get('facilities', []):
            if get_close_matches(query_lower, [item['name'].lower()], n=1, cutoff=0.6):
                return get_formatted_response('facilities', item)

    # Priority 5: Search for holiday information
    holiday_keywords = ['holiday', 'chutti', 'vacation', 'list of holidays']
    if any(keyword in query_lower for keyword in holiday_keywords):
        if data_store.get('holiday_list'):
            return get_formatted_response('holiday_list', data_store['holiday_list'])
    
    # Priority 6: General staff lists (if query is not specific)
    if any(keyword in query_lower for keyword in ['teaching staff', 'faculty']):
        if data_store.get('staff') and data_store['staff'].get('teaching'):
            return get_formatted_response('teaching_staff', data_store['staff']['teaching'])
    if any(keyword in query_lower for keyword in ['non-teaching staff', 'non-faculty', 'office staff']):
        if data_store.get('staff') and data_store['staff'].get('non_teaching'):
            return get_formatted_response('non_teaching_staff', data_store['staff']['non_teaching'])
        
    return None

# --- Flask Routes ---
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask_chatbot_api():
    user_query = request.json.get('query', '').lower()
    if not user_query:
        return jsonify({'error': 'No query provided.'}), 400

    greetings = ['hi', 'hello', 'hey', 'namaste', 'namaskar']
    if any(word in user_query.split() for word in greetings):
        return jsonify({'response': {'text': 'Hello! I am your college campus assistant. How can I help you today?'}})
    
    local_response = search_data_store(user_query)
    if local_response:
        return jsonify(local_response)
    
    return ask_ai(user_query)

# Run the app
if __name__ == '__main__':
    app.run(debug=True)