import requests
from bs4 import BeautifulSoup
import json
import re

# Tumhare college ki website ka URL
base_url = "https://kisancollege.ac.in/"

# Ek dictionary jismein hum data store karenge
extracted_data = {
    "departments": [],
    "faculty_links": [],
    "admission_links": [],
    "contact_info": []
}

# Website par common keywords dhundhne ke liye
keywords = {
    "departments": ["department", "departments", "विभा"],
    "faculty": ["faculty", "staff", "शिक्षकों", "शिक्षक"],
    "admission": ["admission", "admissions", "दाखिला", "प्रवेश"],
    "contact": ["contact", "संपर्क", "contact us"]
}

try:
    print("Website se data nikalne ki koshish kar raha hoon...")

    # Website ka homepage fetch karo
    response = requests.get(base_url, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.content, 'html.parser')

    # Alag-alag keywords ke liye links dhoondho
    all_links = soup.find_all('a', href=True)
    
    for link in all_links:
        link_text = link.get_text().strip()
        link_href = link['href']

        # Agar link text mein koi keyword milta hai to usse save karo
        if any(keyword in link_text.lower() for keyword in keywords["departments"]):
            extracted_data["departments"].append({"name": link_text, "url": link_href})
        elif any(keyword in link_text.lower() for keyword in keywords["faculty"]):
            extracted_data["faculty_links"].append({"name": link_text, "url": link_href})
        elif any(keyword in link_text.lower() for keyword in keywords["admission"]):
            extracted_data["admission_links"].append({"name": link_text, "url": link_href})
        elif any(keyword in link_text.lower() for keyword in keywords["contact"]):
            extracted_data["contact_info"].append({"name": link_text, "url": link_href})

    # Ab, poore page se bhi keywords dhoondho
    page_text = soup.get_text()
    
    # Example: Contact number dhoondhne ka ek tareeka
    phone_numbers = re.findall(r'(\d{5}[-.\s]?\d{6}|\d{10})', page_text)
    if phone_numbers:
        extracted_data["contact_info"].append({"name": "Phone Numbers", "details": list(set(phone_numbers))})

    # Data ko file mein save karo
    with open('college_data.json', 'w', encoding='utf-8') as f:
        json.dump(extracted_data, f, indent=4, ensure_ascii=False)
        
    print("Data nikaal liya gaya aur college_data.json file mein save ho gaya.")

except requests.exceptions.RequestException as e:
    print(f"Website ko fetch karne mein error: {e}")
except Exception as e:
    print(f"Ek anishchit error aa gaya: {e}")