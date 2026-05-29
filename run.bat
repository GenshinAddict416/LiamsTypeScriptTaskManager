@echo off

start ./my-todo-server

timeout /t 2

start "" "http://localhost:3000/"
