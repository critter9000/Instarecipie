#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "The recipient don’t have a Foto from the respective videos. User confirmed: fix photos for existing and new recipes. Example https://www.youtube.com/shorts/ysaHg7qzoK0"
backend:
  - task: "Original-source photos for new and existing recipes"
    implemented: true
    working: true
    file: "backend/recipe_photos.py, backend/photo_jobs.py, backend/object_storage.py, backend/server.py"
    stuck_count: 0
    priority: high
    needs_retesting: false
    status_history:
      - working: false
        agent: user
        comment: "Saved recipes lack photos from the respective source videos."
      - working: NA
        agent: main
        comment: "Replaced stock/reader-first-image fallback with exact YouTube video ID and verified metadata images. Managed storage integration working, migration has repaired 11 source images including existing user's caramelized onion chicken pasta Short. New imports resolve photos asynchronously; explicit refresh endpoint; no recipe text changed during migration."
      - working: true
        agent: testing
        comment: "17/17 targeted backend tests passed: exact user Short import, stored JPEG, refresh revision, ownership/deletion checks, migration invariants and parser edge cases. See iteration_3.json."
frontend:
  - task: "Source photos in cookbook, details and planner with honest fallback and refresh"
    implemented: true
    working: true
    file: "frontend/src/components/SourcePhoto.tsx, frontend/src/components/RecipeCard.tsx, frontend/app/recipe/[id].tsx, frontend/app/(tabs)/planner.tsx, frontend/src/api.ts"
    stuck_count: 0
    priority: high
    needs_retesting: false
    status_history:
      - working: NA
        agent: main
        comment: "Shared image component with load/error states and managed-image URL resolution, recipe photo status and refresh action, pending-photo polling. No stock fallbacks."
      - working: true
        agent: testing
        comment: "Mobile preview library/detail/planner/refresh/fallback and scaler/grocery regression verified. Main also visually confirmed exact user Short original thumbnail. No photo-flow bugs. Existing third-party deprecation warnings remain non-blocking."
metadata:
  created_by: main_agent
  version: '3.0'
  test_sequence: 3
  run_ui: true
test_plan:
  current_focus:
    - "Exact user YouTube Short thumbnail, stored binary and fresh import"
    - "Existing recipe repaired without changing ingredients/steps; idempotent migration"
    - "Recipe photos render in library/details/planner, refresh updates queries"
    - "Unavailable images show neutral state; invalid image bytes and wrong household rejected"
  stuck_tasks: []
  test_all: false
  test_priority: high_first
  completed: true
agent_communication:
  - agent: main
    message: "Use current frontend .env preview URL. Sample legacy repaired recipe 61624a40-29d1-477a-bb01-229dc524e82a is in household c71d39fb-00b0-4f87-93a9-aba45690e770. Do not modify this user recipe. Create test household for user Short import. Source-photo acquisition is real (no runtime mocks); fixture unit tests may stub network edge cases. LLM import latency pre-existing, use direct backend for slow integration tests if external request times out."