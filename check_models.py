# import google.generativeai as genai
# import os

# # Apni Gemini API key yahan daalo
# genai.configure(api_key="AIzaSyA5bWJnFXMRRrfVPr3aOi7HJR_JdAzGFPY")

# for model in genai.list_models():
#     if 'generateContent' in model.supported_generation_methods:
#         print(model.name)



import os

key_name = "GEMINI_API_KEY"
key_value = os.environ.get(key_name)

if key_value:
    print(f"Success! The environment variable '{key_name}' is set.")
    print(f"The value is: {key_value[:5]}...{key_value[-5:]}") # Prints a part of the key for safety
else:
    print(f"Error! The environment variable '{key_name}' is NOT set.")