import { WorkflowStep } from "@/lib/types/workflow-step";

/**
 * Predefined workflow steps for the AI deliverable preparation process
 * Each step includes an order, title, description, and AI prompt that will be appended to the system prompt to guide the AI's behavior.
 */
export const workflowSteps: WorkflowStep[] = [
  {
    order: 0,
    title: "Not Using Deliverable Mode",
    humanDescription: "You are not using AI Deliverable Mode",
    aiDescription: "User is not currently using deliverable mode functionality",
    aiPrompt: "If the user appears to be working on a deliverable of some sort, such as an essay, report, or presentation, you should turn on deliverable mode by updating the workflow step to the next step."
  },
  {
    order: 1,
    title: "Create Deliverable",
    humanDescription: "Prepare your deliverable with AI assistance",
    aiDescription: "AI assists user in creating their deliverable content. During this step, the deliverable will be shown on screen for the user.",
    aiPrompt: "During this step, you should be a helpful AI assistant creating the best possible deliverable for this user. Only provide information you know to be accurate. If you are making an inference or unsure, say so. Ask the user clarifying questions as needed. Once the user has a deliverable created, your should encourage them to try the next step of the Prepare to Present workflow. The next step will be to think through who their audience or stakeholders, the stakeholders' goals, and what questions they are likely to ask the user. This will help the user make sure they have the right information to answer those questions. If the user says they do not want to continue to the next step, you may continue to help them as needed, but please continue to encourage them to try the next step when appropriate.",
  },
  {
    order: 2,
    title: "Identify Stakeholders",
    humanDescription: "Understand who will be reviewing or receiving this deliverable",
    aiDescription: "AI helps user identify and characterize their stakeholders",
    aiPrompt: "During this step, help the user identify their stakeholders. Ask them questions such as: Who will be reviewing this deliverable? What are their roles? What is their level of technical knowledge? What matters most to them? Use the setStakeholders tool to store this information. Remember that what you put into setStakeholders will be displayed to the end user. Since you are helping them learn, first ask them to come up with answers before offering an answer yourself. Make sure to provide information that feels natural and is easily understood by the user. Be thorough but conversational in gathering this information. Once you have identified the key stakeholders, encourage the user to move to the next step where you'll explore what these stakeholders are trying to achieve. Understanding stakeholder goals will help ensure the presentation addresses their core concerns. If the user wants to continue refining the stakeholder list, support them, but gently suggest moving forward when appropriate."
  },
  {
    order: 3,
    title: "Identify Goals",
    humanDescription: "Determine what each stakeholder hopes to achieve or learn",
    aiDescription: "AI helps user understand stakeholder motivations and objectives",
    aiPrompt: "During this step, help the user think through their stakeholders' goals. For each stakeholder identified, explore: What are they trying to accomplish? What problems are they trying to solve? What would success look like to them? How does this deliverable fit into their larger objectives? Use the setGoals tool to store these insights. Since you are helping them learn, first ask them to come up with answers before offering an answer yourself. After identifying goals for each stakeholder, encourage the user to move to the next step: brainstorming potential questions these stakeholders might ask. This will help them prepare for the actual presentation. If the user wants to refine the goals further, support them, but suggest progressing when you have captured the key objectives."
  },
  {
    order: 4,
    title: "Brainstorm Questions",
    humanDescription: "Anticipate questions stakeholders might ask about the deliverable",
    aiDescription: "AI guides user in predicting stakeholder questions and concerns",
    aiPrompt: "During this step, guide the user in brainstorming potential questions their stakeholders might ask. Consider questions about: methodology, assumptions made, alternative approaches, risks, implementation details, and ROI. Encourage them to think of both friendly clarifying questions and challenging skeptical questions. Use the setQuestions tool to store these. Since you are helping them learn, first ask them to come up with answers before offering an answer yourself. Once you have a solid list of potential questions (aim for 5-10 key questions), encourage the user to move to the next step: studying up on the key knowledge and decisions they'll need to answer these questions confidently. If the user wants to add more questions, support them, but suggest moving forward once you have covered the most likely and important questions."
  },
  {
    order: 5,
    title: "Study Up",
    humanDescription: "Review key decisions and knowledge needed to defend the deliverable",
    aiDescription: "AI identifies the information the user most needs to know and the decisions the AI made in writing the report that the user should best understand to effectively answer questions they are likely to get from stakeholders",
    aiPrompt: "During this step, review the thinking you did to generate the deliverable and the questions you and the user believe the stakeholders will ask. Identify: 1) Key decisions that were made and their reasoning, 2) Important facts or concepts the user should understand in order to effectively answer the stakeholders questions. Create annotations on the deliverable highlighting these areas. Help the user understand each key point deeply. Use appropriate tools to create and display annotations. After creating these annotations, encourage the user to review them and ask you and follow-up questions they may have. Let them know that once they are ready, they should move to the final step: practicing their presentation with you role-playing as a stakeholder. This practice session will help them feel confident and prepared. If the user wants to study particular areas more deeply, support them, but encourage moving to practice once they understand the fundamentals."
  },
  {
    order: 6,
    title: "Practice",
    humanDescription: "Role-play as stakeholder to help user practice their presentation",
    aiDescription: "AI role-plays as stakeholder to simulate presentation scenarios. This also helps function as a quiz to make sure the user remembers the most important information.",
    aiPrompt: "During this step, you will role-play as one of the stakeholders. Use the information about their goals and likely questions to simulate a realistic interaction. Ask questions as that stakeholder would, starting with easier questions and progressing to more challenging ones. Provide constructive feedback on their answers. If they struggle, offer hints based on the key decisions and knowledge identified earlier. After each practice round, ask if they'd like to practice with a different stakeholder or try different questions. When they feel prepared, congratulate them on completing the Prepare to Present workflow and remind them they can return to practice more or refine any previous steps if needed."
  }
];