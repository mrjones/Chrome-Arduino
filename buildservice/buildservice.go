package main

import (
	"bytes"
	"fmt"
	"html/template"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"time"
)


type BuildServer struct {
	uploadDirectory string
}

func (s *BuildServer) uploadForm(w http.ResponseWriter, r *http.Request) {
	template.Must(template.ParseFiles(
		"templates/upload_form.html")).Execute(w, nil)
}

func (s *BuildServer) handleUpload(w http.ResponseWriter, r *http.Request) {
	const ONE_MB = 1024 * 1024;

	err := r.ParseMultipartForm(ONE_MB)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(
			fmt.Sprintf("Error parsing data: %s\n", err.Error())))
		return
	}

	for key, value := range r.MultipartForm.Value {
		fmt.Fprintf(w, "%s:%s\n", key, value)
	}

	for k, fileHeaders := range r.MultipartForm.File {
		for i, fileHeader := range fileHeaders {
			fmt.Fprintf(w, "===\n=== %s[%d]:%s\n===\n", k, i, fileHeader.Filename)
			file, err := fileHeader.Open()
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(
					fmt.Sprintf("Error opening uploaded file: %s\n", err.Error())))
				return
			}
			buf, err := ioutil.ReadAll(file)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(
					fmt.Sprintf("Error reading uploaded file: %s\n", err.Error())))
				return
			}
			w.Write(buf)

			uniqueRoot := fmt.Sprintf("%s/%d", s.uploadDirectory, time.Now().UnixNano())
			srcDir := fmt.Sprintf("%s/src", uniqueRoot)
			outfilename := fmt.Sprintf("%s/%s", srcDir, fileHeader.Filename)

			os.MkdirAll(srcDir, os.ModePerm)
			err = ioutil.WriteFile(outfilename, buf, os.ModePerm)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(
					fmt.Sprintf("Error reading uploaded file: %s\n", err.Error())))
				return
			}

			cmd := exec.Command("ino", "build")
			cmd.Dir = uniqueRoot

			var cmdOut bytes.Buffer
			cmd.Stdout = &cmdOut
			err = cmd.Run()
			w.Write([]byte("===\n===\n===\n"))
			w.Write(cmdOut.Bytes())
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(
					fmt.Sprintf("Error compiling: %s\n", err.Error())))
				return
			}
		}
	}
}

func main() {
	server := &BuildServer{uploadDirectory: "./uploads"}
	http.HandleFunc("/handle_upload", server.handleUpload)
	http.HandleFunc("/", server.uploadForm)
	http.ListenAndServe(":7221", nil)
}
