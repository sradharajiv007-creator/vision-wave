CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c99
LDFLAGS = -lm
TARGET = optimizer
SOURCE = optimizer.c

all: $(TARGET)

$(TARGET): $(SOURCE)
	$(CC) $(CFLAGS) -o $(TARGET) $(SOURCE) $(LDFLAGS)

clean:
	rm -f $(TARGET) $(TARGET).exe

test: $(TARGET)
	./$(TARGET) 5.0 2.5 20.0 1.2 0.8 0.5

.PHONY: all clean test

