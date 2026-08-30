# Code style                                                                                                                            
                                                                                                                                        
Minimize comments. The code is the source of truth — let it speak for itself.                                                           
                                                                                                                                        
- Default to **no comments**. Prefer clear names, small functions, and obvious control flow over explanatory prose.                                                                                                  
- Add a comment **only if absolutely needed** 
  e.g. a non-obvious "why" (a workaround, an external constraint, a subtle invariant) that the code cannot express on its own.                                                                                                                   
- Do not add comments that restate what the code already says, narrate steps, or label sections.                                                                                                                    
- Do not leave TODO/placeholder or "changed X" commentary.                                                                              
- Docstrings: only where they earn their place (public/exported API with non-obvious contract). Keep them short.                                                                                               
                                                                                                                                        
                                