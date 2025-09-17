# Specify MCP를 사용한 Todo App 프로젝트 생성 예시

## 1단계: 프로젝트 초기화

```json
{
  "tool": "initialize_project",
  "arguments": {
    "projectName": "svelte-todo-app",
    "description": "스벨트로 만든 심플한 UI/UX의 투두 웹앱",
    "domain": "productivity",
    "goals": [
      "할 일 추가 및 삭제 기능",
      "완료 상태 토글 기능",
      "로컬 스토리지 저장",
      "깔끔한 UI 디자인"
    ],
    "constraints": [
      "브라우저 전용 앱",
      "백엔드 없음",
      "모바일 반응형"
    ]
  }
}
```

응답에서 `PROJECT_ID: svelte-todo-app` 확인

## 2단계: 사양 문서 생성

```json
{
  "tool": "create_specification",
  "arguments": {
    "projectId": "svelte-todo-app",
    "userRequirements": "사용자는 할 일을 추가, 수정, 삭제할 수 있어야 하며, 완료된 항목은 시각적으로 구분되어야 합니다.",
    "focusAreas": ["user experience", "simplicity"],
    "excludeAreas": ["authentication", "server-side"]
  }
}
```

## 3단계: 기술 계획 생성

```json
{
  "tool": "create_technical_plan",
  "arguments": {
    "projectId": "svelte-todo-app",
    "techStack": {
      "frontend": ["Svelte", "TypeScript"],
      "backend": [],
      "database": [],
      "testing": ["Vitest"]
    },
    "architecture": "single-page-application"
  }
}
```

## 4단계: 작업 분해

```json
{
  "tool": "breakdown_tasks",
  "arguments": {
    "projectId": "svelte-todo-app",
    "granularity": "medium",
    "groupingStrategy": "feature"
  }
}
```

## 5단계: TDD 테스트 생성

```json
{
  "tool": "generate_tests",
  "arguments": {
    "projectId": "svelte-todo-app",
    "taskId": "TASK-001",
    "testingFramework": "vitest",
    "tddApproach": "red-green-refactor"
  }
}
```

## 주의사항

1. **projectId는 필수**: `initialize_project` 실행 후 반환된 PROJECT_ID를 다음 단계에서 사용
2. **순차적 실행**: 각 단계는 이전 단계의 결과를 기반으로 함
3. **프로젝트 구조**: 모든 산출물은 `.specify/svelte-todo-app/` 폴더에 저장됨
