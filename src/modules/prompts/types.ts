export interface PromptSuggestion {
  id: string;
  sessionId?: string;
  title: string;
  body: string;
  transcriptId?: string;
  transcriptIds?: string[];
                                                                                   
  timestamp: string;
                                                                                
  transcriptTimeLabel?: string;
     
                                                             
                                                                                 
     
  suggestionOrigin?: "model" | "local";
}
