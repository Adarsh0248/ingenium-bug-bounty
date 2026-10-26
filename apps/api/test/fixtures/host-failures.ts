import type { HostExecutionCase } from "./host-executions.js";

export const HOST_FAILURE_CASES: readonly HostExecutionCase[] = [
  {id:"c-compile",language:"c",source:"int main(void){ return missing_name; }\n",result:"COMPILATION_ERROR"},
  {id:"cpp-compile",language:"cpp",source:"int main(){ return missing_name; }\n",result:"COMPILATION_ERROR"},
  {id:"java-compile",language:"java",source:"public class Main{public static void main(String[]args){ int x = ; }}\n",result:"COMPILATION_ERROR"},
  {id:"python-syntax",language:"python",source:"def broken(:\n",result:"RUNTIME_ERROR"},
  {id:"javascript-syntax",language:"javascript",source:"const = ;\n",result:"RUNTIME_ERROR"},
  {id:"cpp-wrong",language:"cpp",source:'#include <cstdio>\nint main(){ puts("13"); }\n',result:"WRONG_ANSWER"},
  {id:"cpp-nonzero",language:"cpp",source:"int main(){ return 3; }\n",result:"RUNTIME_ERROR"},
  {id:"cpp-signal",language:"cpp",source:"#include <unistd.h>\n#include <signal.h>\nint main(){usleep(200000);raise(SIGSEGV);}\n",result:"RUNTIME_ERROR"},
  {id:"cpp-cpu",language:"cpp",source:"int main(){volatile unsigned long n=0;for(;;)n=n+1;}\n",cpuMs:250,wallMs:3000,result:"TIME_LIMIT_EXCEEDED"},
  {id:"cpp-wall",language:"cpp",source:"#include <unistd.h>\nint main(){sleep(10);}\n",cpuMs:250,wallMs:1000,result:"TIME_LIMIT_EXCEEDED"},
  {id:"cpp-memory",language:"cpp",source:"#include <unistd.h>\n#include <cstdlib>\nint main(){usleep(200000);for(;;){volatile char*p=(char*)malloc(1048576);if(!p)return 3;for(int i=0;i<1048576;i+=4096)p[i]=1;}}\n",memoryKb:32768,result:"MEMORY_LIMIT_EXCEEDED"},
  {id:"cpp-output",language:"cpp",source:"#include <unistd.h>\nint main(){usleep(200000);char b[4096]={};for(;;)write(1,b,sizeof b);}\n",result:"OUTPUT_LIMIT_EXCEEDED"},
  {id:"boundary",language:"c",source:'#include <stdio.h>\n#include <unistd.h>\n#include <fcntl.h>\nint main(void){if(getuid()!=60000||getgid()!=60000)return 23;const char*p[]={"/opt/ingenium/judge-executor/capsule.json","/proc/1/environ","/sys/fs/cgroup/memory/tasks","/etc/shadow"};for(int i=0;i<4;i++){int f=open(p[i],O_RDONLY);if(f>=0)return 24;}if(open("/usr/ingenium-write-probe",O_CREAT|O_WRONLY,0600)>=0)return 25;puts("12");}\n',result:"PASSED"},
  {id:"fork-limit",language:"c",source:'#include <stdio.h>\n#include <unistd.h>\n#include <sys/wait.h>\n#include <errno.h>\nint main(void){int count=0;for(int i=0;i<70;i++){pid_t p=fork();if(p==0){sleep(1);_exit(0);}if(p<0){if(errno!=EAGAIN)return 3;break;}count++;}while(wait(0)>0){}if(count==0||count>=70)return 4;puts("12");}\n',result:"PASSED"},
];
